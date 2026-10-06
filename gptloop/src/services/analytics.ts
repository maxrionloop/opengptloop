import type { Provider, ChatCompletionOptions, StreamDelta } from "../agents/providers/types.js";
import {
  estimateCompletionTokens,
  estimatePromptTokens,
  toTokenTriple,
} from "../tokens.js";
import type { AnalyticsLogRecord } from "../database/repositories/analyticsRepo.js";
import type { GptLoopDatabase } from "../database/index.js";

/**
 * Centralized AI usage + agent activity analytics.
 *
 * Every one of the 30+ providers flows through the SAME structure: agent
 * runtimes call `streamWithAnalytics()` instead of `provider.streamChatCompletion()`
 * directly. The wrapper measures latency, collects provider-reported usage when
 * the stream carries it, falls back to the built-in token counter otherwise,
 * and persists one log row per LLM call — without ever slowing down or
 * breaking the agent (all persistence is best-effort, capped, and sync-cheap).
 *
 * Read-only for the dashboard: `GET /api/analytics/*` only reads. Nothing
 * here mutates agent state, transcripts, or settings.
 */

export type AgentType =
  | "main"
  | "chat"
  | "subagent"
  | "team"
  | "ceo"
  | "memory"
  | "custom"
  | "channel"
  | "schedule";

export type TokenSource = "provider" | "estimated" | "none";

export interface TrackedCallContext {
  /** Chat/session id the call belongs to (used for per-session dashboard filtering). */
  sessionId: string;
  /** Agent surface making the call. */
  agentType: AgentType;
  /** Provider id (e.g. "openrouter"); label resolved from the provider when omitted. */
  provider: string;
  providerLabel?: string;
  model: string;
}

export interface AnalyticsLogView {
  id: string;
  sessionId: string;
  timestamp: number;
  kind: string;
  provider: string;
  providerLabel: string | null;
  model: string;
  agentType: string;
  requestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  tokenSource: TokenSource;
  latencyMs: number | null;
  status: "success" | "error";
  errorCode: string | null;
  errorMessage: string | null;
  costUsd: number | null;
  promptChars: number | null;
  completionChars: number | null;
  toolCalls: number | null;
  toolNames: string[];
  message: string | null;
  metadata: Record<string, unknown> | null;
}

/** In-memory ring cap: bounds RAM no matter how many requests arrive. */
const MEMORY_CAP = 2000;
/** SQLite cap: oldest rows pruned beyond this (keeps the DB fast forever). */
const DB_CAP = 20000;

function randomId(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function createLogId(): string {
  return `${Date.now().toString(36)}${randomId(6)}`.slice(0, 12);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function parseToolNames(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

class AnalyticsStore {
  private db: GptLoopDatabase | null = null;
  private readonly memory: AnalyticsLogView[] = [];
  private sinceInsertCount = 0;

  /** Called once at boot so logs persist in SQLite (optional — memory-only when absent). */
  attachDatabase(db: GptLoopDatabase): void {
    this.db = db;
  }

  /** Persist one record: memory ring (always) + SQLite (best-effort, never throws). */
  record(entry: {
    sessionId: string;
    kind?: string;
    provider: string;
    providerLabel?: string | null;
    model: string;
    agentType: AgentType | string;
    requestId?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    tokenSource: TokenSource;
    latencyMs?: number | null;
    status: "success" | "error";
    errorCode?: string | null;
    errorMessage?: string | null;
    costUsd?: number | null;
    promptChars?: number | null;
    completionChars?: number | null;
    toolCalls?: number | null;
    toolNames?: string[];
    message?: string | null;
    metadata?: Record<string, unknown> | null;
  }): AnalyticsLogView {
    const timestamp = Date.now();
    const totalTokens =
      entry.totalTokens != null
        ? entry.totalTokens
        : entry.inputTokens != null || entry.outputTokens != null
          ? (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0)
          : null;
    const view: AnalyticsLogView = {
      id: createLogId(),
      sessionId: entry.sessionId || "unknown",
      timestamp,
      kind: entry.kind ?? "llm_request",
      provider: entry.provider || "unknown",
      providerLabel: entry.providerLabel ?? null,
      model: entry.model || "unknown",
      agentType: entry.agentType || "main",
      requestId: entry.requestId ?? null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      totalTokens,
      tokenSource: entry.tokenSource,
      latencyMs: entry.latencyMs ?? null,
      status: entry.status,
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
      costUsd: entry.costUsd ?? null,
      promptChars: entry.promptChars ?? null,
      completionChars: entry.completionChars ?? null,
      toolCalls: entry.toolCalls ?? null,
      toolNames: entry.toolNames ?? [],
      message: entry.message ?? null,
      metadata: entry.metadata ?? null,
    };

    // Memory ring: O(1) append, drop oldest beyond cap.
    this.memory.push(view);
    if (this.memory.length > MEMORY_CAP) {
      this.memory.splice(0, this.memory.length - MEMORY_CAP);
    }

    // SQLite: single-row prepared insert, best-effort.
    if (this.db) {
      try {
        const record: AnalyticsLogRecord = {
          id: view.id,
          sessionId: view.sessionId,
          timestamp: view.timestamp,
          kind: view.kind,
          provider: view.provider,
          providerLabel: view.providerLabel,
          model: view.model,
          agentType: view.agentType,
          requestId: view.requestId,
          inputTokens: view.inputTokens,
          outputTokens: view.outputTokens,
          totalTokens: view.totalTokens,
          tokenSource: view.tokenSource,
          latencyMs: view.latencyMs,
          status: view.status,
          errorCode: view.errorCode,
          errorMessage: view.errorMessage,
          costUsd: view.costUsd,
          promptChars: view.promptChars,
          completionChars: view.completionChars,
          toolCalls: view.toolCalls,
          toolNames: view.toolNames.length > 0 ? JSON.stringify(view.toolNames) : null,
          message: view.message,
          metadata: view.metadata ? JSON.stringify(view.metadata) : null,
        };
        this.db.analytics.insert(record);
        this.sinceInsertCount += 1;
        if (this.sinceInsertCount >= 500) {
          this.sinceInsertCount = 0;
          this.db.analytics.prune(DB_CAP);
        }
      } catch {
        // Logging must never break the agent.
      }
    }
    return view;
  }

  /**
   * Record a generic agent event (retry, fallback, warning, info). Token
   * fields stay null; the row still shows in the log viewer with full metadata.
   */
  recordEvent(entry: {
    sessionId: string;
    provider?: string;
    model?: string;
    agentType?: AgentType | string;
    status?: "success" | "error";
    message: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    latencyMs?: number | null;
    metadata?: Record<string, unknown> | null;
  }): AnalyticsLogView {
    return this.record({
      sessionId: entry.sessionId,
      kind: "agent_event",
      provider: entry.provider ?? "agent",
      providerLabel: null,
      model: entry.model ?? "",
      agentType: entry.agentType ?? "main",
      tokenSource: "none",
      status: entry.status ?? "success",
      message: entry.message,
      errorCode: entry.errorCode ?? null,
      errorMessage: entry.errorMessage ?? null,
      latencyMs: entry.latencyMs ?? null,
      metadata: entry.metadata ?? null,
    });
  }

  list(filter: {
    sessionId?: string;
    provider?: string;
    model?: string;
    status?: "success" | "error";
    tokenSource?: "provider" | "estimated";
    agentType?: string;
    search?: string;
    since?: number;
    limit?: number;
    offset?: number;
  } = {}): { logs: AnalyticsLogView[]; totalInMemory: number } {
    // Prefer SQLite when attached (durable + indexed); else filter memory.
    if (this.db) {
      try {
        const rows = this.db.analytics.list(filter);
        return {
          logs: rows.map((r) => ({
            id: r.id,
            sessionId: r.sessionId,
            timestamp: r.timestamp,
            kind: r.kind,
            provider: r.provider,
            providerLabel: r.providerLabel,
            model: r.model,
            agentType: r.agentType,
            requestId: r.requestId,
            inputTokens: r.inputTokens,
            outputTokens: r.outputTokens,
            totalTokens: r.totalTokens,
            tokenSource: (r.tokenSource === "provider" || r.tokenSource === "estimated"
              ? r.tokenSource
              : "none") as TokenSource,
            latencyMs: r.latencyMs,
            status: r.status === "success" ? "success" : "error",
            errorCode: r.errorCode,
            errorMessage: r.errorMessage,
            costUsd: r.costUsd,
            promptChars: r.promptChars,
            completionChars: r.completionChars,
            toolCalls: r.toolCalls,
            toolNames: parseToolNames(r.toolNames),
            message: r.message,
            metadata: parseMetadata(r.metadata),
          })),
          totalInMemory: this.memory.length,
        };
      } catch {
        // Fall through to memory on DB failure.
      }
    }
    const limit = Math.min(500, Math.max(1, Math.floor(filter.limit ?? 100)));
    const offset = Math.max(0, Math.floor(filter.offset ?? 0));
    const needle = (filter.search ?? "").trim().toLowerCase();
    const filtered = this.memory
      .filter((l) => {
        if (filter.sessionId && l.sessionId !== filter.sessionId) return false;
        if (filter.provider && l.provider !== filter.provider) return false;
        if (filter.model && !l.model.toLowerCase().includes(filter.model.toLowerCase())) return false;
        if (filter.status && l.status !== filter.status) return false;
        if (filter.tokenSource && l.tokenSource !== filter.tokenSource) return false;
        if (filter.agentType && l.agentType !== filter.agentType) return false;
        if (filter.since != null && l.timestamp < filter.since) return false;
        if (needle) {
          const hay = `${l.model} ${l.provider} ${l.errorMessage ?? ""} ${l.message ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : -1));
    return { logs: filtered.slice(offset, offset + limit), totalInMemory: this.memory.length };
  }

  getById(id: string): AnalyticsLogView | undefined {
    const mem = this.memory.find((l) => l.id === id);
    if (mem) return mem;
    if (this.db) {
      try {
        const r = this.db.analytics.get(id);
        if (!r) return undefined;
        return {
          id: r.id,
          sessionId: r.sessionId,
          timestamp: r.timestamp,
          kind: r.kind,
          provider: r.provider,
          providerLabel: r.providerLabel,
          model: r.model,
          agentType: r.agentType,
          requestId: r.requestId,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          totalTokens: r.totalTokens,
          tokenSource: (r.tokenSource === "provider" || r.tokenSource === "estimated"
            ? r.tokenSource
            : "none") as TokenSource,
          latencyMs: r.latencyMs,
          status: r.status === "success" ? "success" : "error",
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          costUsd: r.costUsd,
          promptChars: r.promptChars,
          completionChars: r.completionChars,
          toolCalls: r.toolCalls,
          toolNames: parseToolNames(r.toolNames),
          message: r.message,
          metadata: parseMetadata(r.metadata),
        };
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  stats(filter: { sessionId?: string; provider?: string; since?: number } = {}): {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    providerTokens: number;
    estimatedTokens: number;
    totalCostUsd: number;
    hasCost: boolean;
    avgLatencyMs: number | null;
    minLatencyMs: number | null;
    maxLatencyMs: number | null;
    byProvider: Array<{ provider: string; requests: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: number }>;
    byModel: Array<{ model: string; provider: string; requests: number; totalTokens: number; errors: number }>;
    byStatus: { success: number; error: number };
    recentActivity: AnalyticsLogView[];
  } {
    if (this.db) {
      try {
        const s = this.db.analytics.stats(filter);
        const { logs } = this.list({
          sessionId: filter.sessionId,
          provider: filter.provider,
          since: filter.since,
          limit: 10,
        });
        return { ...s, recentActivity: logs };
      } catch {
        // Fall through to memory.
      }
    }
    // Memory-only fallback.
    const rows = this.memory.filter((l) => {
      if (filter.sessionId && l.sessionId !== filter.sessionId) return false;
      if (filter.provider && l.provider !== filter.provider) return false;
      if (filter.since != null && l.timestamp < filter.since) return false;
      return true;
    });
    let successCount = 0;
    let errorCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let providerTokens = 0;
    let estimatedTokens = 0;
    let totalCostUsd = 0;
    let hasCost = false;
    let latencySum = 0;
    let latencyN = 0;
    let minLatency: number | null = null;
    let maxLatency: number | null = null;
    const byProvider = new Map<string, { provider: string; requests: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: number }>();
    const byModel = new Map<string, { model: string; provider: string; requests: number; totalTokens: number; errors: number }>();
    for (const l of rows) {
      if (l.status === "success") successCount += 1;
      else errorCount += 1;
      const input = l.inputTokens ?? 0;
      const output = l.outputTokens ?? 0;
      const total = l.totalTokens ?? input + output;
      totalInputTokens += input;
      totalOutputTokens += output;
      totalTokens += total;
      if (l.tokenSource === "provider") providerTokens += total;
      else if (l.tokenSource === "estimated") estimatedTokens += total;
      if (typeof l.costUsd === "number" && Number.isFinite(l.costUsd)) {
        totalCostUsd += l.costUsd;
        hasCost = true;
      }
      if (typeof l.latencyMs === "number" && Number.isFinite(l.latencyMs)) {
        latencySum += l.latencyMs;
        latencyN += 1;
        if (minLatency === null || l.latencyMs < minLatency) minLatency = l.latencyMs;
        if (maxLatency === null || l.latencyMs > maxLatency) maxLatency = l.latencyMs;
      }
      const p = byProvider.get(l.provider) ?? { provider: l.provider, requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, errors: 0 };
      p.requests += 1;
      p.inputTokens += input;
      p.outputTokens += output;
      p.totalTokens += total;
      if (l.status !== "success") p.errors += 1;
      byProvider.set(l.provider, p);
      const key = `${l.provider}::${l.model}`;
      const m = byModel.get(key) ?? { model: l.model, provider: l.provider, requests: 0, totalTokens: 0, errors: 0 };
      m.requests += 1;
      m.totalTokens += total;
      if (l.status !== "success") m.errors += 1;
      byModel.set(key, m);
    }
    return {
      totalRequests: rows.length,
      successCount,
      errorCount,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      providerTokens,
      estimatedTokens,
      totalCostUsd,
      hasCost,
      avgLatencyMs: latencyN > 0 ? Math.round(latencySum / latencyN) : null,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
      byProvider: Array.from(byProvider.values()).sort((a, b) => b.totalTokens - a.totalTokens),
      byModel: Array.from(byModel.values()).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, 50),
      byStatus: { success: successCount, error: errorCount },
      recentActivity: [...rows].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10),
    };
  }

  distinctProviders(sessionId?: string): string[] {
    if (this.db) {
      try {
        return this.db.analytics.distinctProviders(sessionId);
      } catch {
        // Fall through to memory.
      }
    }
    const set = new Set<string>();
    for (const l of this.memory) {
      if (sessionId && l.sessionId !== sessionId) continue;
      if (l.provider) set.add(l.provider);
    }
    return Array.from(set).sort();
  }

  clear(sessionId?: string): void {
    if (sessionId && sessionId.trim().length > 0) {
      const id = sessionId.trim();
      for (let i = this.memory.length - 1; i >= 0; i -= 1) {
        if (this.memory[i]!.sessionId === id) this.memory.splice(i, 1);
      }
    } else {
      this.memory.length = 0;
    }
    if (this.db) {
      try {
        this.db.analytics.clear(sessionId);
      } catch {
        // best effort
      }
    }
  }
}

/** The process-wide singleton every provider/agent surface shares. */
export const analytics = new AnalyticsStore();

/**
 * Tracked streaming wrapper — the ONLY way agent runtimes call providers.
 *
 * - Measures wall-clock latency for the whole stream.
 * - Forwards every delta unchanged (agent behavior is identical).
 * - Collects provider-reported usage (`usage` on any delta) + request id when
 *   the provider supplies them; otherwise estimates via the built-in counter.
 * - Persists exactly one analytics row per call (success or error).
 * - Never throws because of analytics: estimator/persistence failures degrade
 *   to `tokenSource: "none"` / skipped persistence, never a broken turn.
 */
export async function* streamWithAnalytics(
  provider: Provider,
  options: ChatCompletionOptions,
  ctx: TrackedCallContext,
): AsyncGenerator<StreamDelta, void, unknown> {
  const startedAt = Date.now();
  let promptChars = 0;
  let estimatedInput: number | null = null;
  try {
    const messages = Array.isArray(options.messages)
      ? (options.messages as Array<Record<string, unknown>>)
      : [];
    promptChars = JSON.stringify(messages).length;
    estimatedInput = estimatePromptTokens(messages, options.tools);
  } catch {
    estimatedInput = null;
  }

  let sawUsage = false;
  let usageInput: number | null = null;
  let usageOutput: number | null = null;
  let usageTotal: number | null = null;
  let costUsd: number | null = null;
  let requestId: string | null = null;
  let completionText = "";
  let completionReasoning = "";
  const toolNameSet = new Set<string>();
  let toolCallCount = 0;

  const finish = (status: "success" | "error", error?: unknown): void => {
    try {
      const latencyMs = Date.now() - startedAt;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let totalTokens: number | null = null;
      let tokenSource: TokenSource = "none";

      if (sawUsage && (usageInput != null || usageOutput != null || usageTotal != null)) {
        // Provider supplied actual counts — never estimate over them.
        inputTokens = usageInput;
        outputTokens = usageOutput;
        totalTokens =
          usageTotal ?? (inputTokens != null || outputTokens != null ? (inputTokens ?? 0) + (outputTokens ?? 0) : null);
        tokenSource = "provider";
      } else if (status === "success") {
        // No provider usage — fall back to the built-in estimator.
        const estimatedOutput = estimateCompletionTokens(completionText, completionReasoning);
        const triple = toTokenTriple(estimatedInput ?? 0, estimatedOutput);
        inputTokens = triple.inputTokens;
        outputTokens = triple.outputTokens;
        totalTokens = triple.totalTokens;
        tokenSource = "estimated";
      } else {
        // Failed/aborted calls still consumed context: the prompt was sent and a
        // partial completion may have streamed before the failure (abort in
        // mid-response is the common case). Record both so the context meter
        // never undercounts aborted turns — the partial output is part of the
        // transcript and counts toward the next call's context window.
        // When nothing streamed at all this degrades to the old behavior
        // (input estimate, zero output).
        if (estimatedInput != null || completionText.length > 0 || completionReasoning.length > 0) {
          const estimatedOutput = estimateCompletionTokens(completionText, completionReasoning);
          const triple = toTokenTriple(estimatedInput ?? 0, estimatedOutput);
          inputTokens = triple.inputTokens;
          outputTokens = triple.outputTokens;
          totalTokens = triple.totalTokens;
          tokenSource = "estimated";
        }
      }

      const message = status === "error" ? messageOf(error).slice(0, 2000) : null;
      analytics.record({
        sessionId: ctx.sessionId,
        kind: "llm_request",
        provider: ctx.provider || provider.metadata.id,
        providerLabel: ctx.providerLabel ?? provider.metadata.label ?? null,
        model: ctx.model,
        agentType: ctx.agentType,
        requestId,
        inputTokens,
        outputTokens,
        totalTokens,
        tokenSource,
        latencyMs,
        status,
        errorCode: status === "error" ? "provider_api_error" : null,
        errorMessage: message,
        costUsd,
        promptChars,
        completionChars: completionText.length + completionReasoning.length,
        toolCalls: toolCallCount > 0 ? toolCallCount : toolNameSet.size > 0 ? toolNameSet.size : null,
        toolNames: Array.from(toolNameSet),
        message,
        metadata:
          status === "error"
            ? { model: ctx.model, toolCalls: toolCallCount }
            : toolNameSet.size > 0
              ? { model: ctx.model, toolCalls: toolCallCount }
              : { model: ctx.model },
      });
    } catch {
      // Analytics must never break the agent.
    }
  };

  let stream: AsyncGenerator<StreamDelta, void, unknown>;
  try {
    stream = provider.streamChatCompletion(options);
  } catch (error) {
    finish("error", error);
    throw error;
  }

  try {
    for await (const delta of stream) {
      try {
        if (delta.text) completionText += delta.text;
        if (delta.reasoning) completionReasoning += delta.reasoning;
        if (delta.requestId && !requestId) requestId = delta.requestId;
        if (delta.usage) {
          const u = delta.usage as Record<string, unknown>;
          // Accept both normalized camelCase (from base provider parsing) and
          // raw snake_case shapes (custom providers / gateways that yield usage
          // directly) — actual counts must never be missed due to key casing.
          const p = toFiniteNumber(
            u.promptTokens ?? u.prompt_tokens ?? u.input_tokens ?? u.inputTokens,
          );
          const c = toFiniteNumber(
            u.completionTokens ?? u.completion_tokens ?? u.output_tokens ?? u.outputTokens,
          );
          const t = toFiniteNumber(u.totalTokens ?? u.total_tokens ?? u.total);
          if (p != null || c != null || t != null) {
            sawUsage = true;
            if (p != null) usageInput = p;
            if (c != null) usageOutput = c;
            if (t != null) usageTotal = t;
          }
          const cost = toFiniteNumber(
            u.cost ?? u.total_cost ?? u.totalCost ?? u.price ?? u.total_price,
          );
          if (cost != null) costUsd = cost;
          const rid =
            typeof u.requestId === "string"
              ? u.requestId
              : typeof u.request_id === "string"
                ? u.request_id
                : typeof u.id === "string"
                  ? u.id
                  : null;
          if (rid && rid.length > 0 && !requestId) {
            requestId = rid.slice(0, 200);
          }
        }
        if (delta.toolCalls) {
          for (const tc of delta.toolCalls) {
            const name = tc.function?.name;
            if (name && name.trim().length > 0) toolNameSet.add(name.trim().slice(0, 200));
          }
          // Count completed (named) tool calls seen so far.
          toolCallCount = toolNameSet.size;
        }
      } catch {
        // Per-delta bookkeeping must never break streaming.
      }
      yield delta;
    }
    finish("success");
  } catch (error) {
    finish("error", error);
    throw error;
  }
}
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
