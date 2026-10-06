import type Database from "better-sqlite3";

/** One persisted analytics log row (raw storage shape). */
export interface AnalyticsLogRow {
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
  tokenSource: string;
  latencyMs: number | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  costUsd: number | null;
  promptChars: number | null;
  completionChars: number | null;
  toolCalls: number | null;
  toolNames: string | null;
  message: string | null;
  metadata: string | null;
}

interface RawAnalyticsRow {
  id: string;
  session_id: string;
  timestamp: number;
  kind: string;
  provider: string;
  provider_label: string | null;
  model: string;
  agent_type: string;
  request_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  token_source: string;
  latency_ms: number | null;
  status: string;
  error_code: string | null;
  error_message: string | null;
  cost_usd: number | null;
  prompt_chars: number | null;
  completion_chars: number | null;
  tool_calls: number | null;
  tool_names: string | null;
  message: string | null;
  metadata: string | null;
}

function toRow(row: RawAnalyticsRow): AnalyticsLogRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    timestamp: row.timestamp,
    kind: row.kind,
    provider: row.provider,
    providerLabel: row.provider_label,
    model: row.model,
    agentType: row.agent_type,
    requestId: row.request_id,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    tokenSource: row.token_source,
    latencyMs: row.latency_ms,
    status: row.status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    costUsd: row.cost_usd,
    promptChars: row.prompt_chars,
    completionChars: row.completion_chars,
    toolCalls: row.tool_calls,
    toolNames: row.tool_names,
    message: row.message,
    metadata: row.metadata,
  };
}

export interface AnalyticsLogRecord {
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
  tokenSource: "provider" | "estimated" | "none";
  latencyMs: number | null;
  status: "success" | "error";
  errorCode: string | null;
  errorMessage: string | null;
  costUsd: number | null;
  promptChars: number | null;
  completionChars: number | null;
  toolCalls: number | null;
  toolNames: string | null;
  message: string | null;
  metadata: string | null;
}

export interface AnalyticsListFilter {
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
}

/**
 * Analytics logs table. Every read is an indexed point lookup or a bounded
 * range scan ordered by timestamp — replay/list cost stays flat as the table
 * grows. Writes are single-row inserts via a prepared statement (sub-ms),
 * wrapped in best-effort try/catch by callers so logging never breaks the agent.
 */
export class AnalyticsRepo {
  private readonly insertStmt: Database.Statement;
  private readonly selectOne: Database.Statement;
  private readonly countAll: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertStmt = db.prepare(
      `INSERT OR REPLACE INTO analytics_logs
        (id, session_id, timestamp, kind, provider, provider_label, model, agent_type,
         request_id, input_tokens, output_tokens, total_tokens, token_source, latency_ms,
         status, error_code, error_message, cost_usd, prompt_chars, completion_chars,
         tool_calls, tool_names, message, metadata)
       VALUES
        (@id, @sessionId, @timestamp, @kind, @provider, @providerLabel, @model, @agentType,
         @requestId, @inputTokens, @outputTokens, @totalTokens, @tokenSource, @latencyMs,
         @status, @errorCode, @errorMessage, @costUsd, @promptChars, @completionChars,
         @toolCalls, @toolNames, @message, @metadata)`,
    );
    this.selectOne = db.prepare(`SELECT * FROM analytics_logs WHERE id = ?`);
    this.countAll = db.prepare(`SELECT COUNT(*) AS n FROM analytics_logs`);
  }

  insert(record: AnalyticsLogRecord): void {
    this.insertStmt.run({
      id: record.id,
      sessionId: record.sessionId,
      timestamp: record.timestamp,
      kind: record.kind,
      provider: record.provider,
      providerLabel: record.providerLabel,
      model: record.model,
      agentType: record.agentType,
      requestId: record.requestId,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      tokenSource: record.tokenSource,
      latencyMs: record.latencyMs,
      status: record.status,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      costUsd: record.costUsd,
      promptChars: record.promptChars,
      completionChars: record.completionChars,
      toolCalls: record.toolCalls,
      toolNames: record.toolNames,
      message: record.message,
      metadata: record.metadata,
    });
  }

  get(id: string): AnalyticsLogRow | undefined {
    const row = this.selectOne.get(id) as RawAnalyticsRow | undefined;
    return row ? toRow(row) : undefined;
  }

  count(): number {
    const row = this.countAll.get() as { n: number } | undefined;
    return row?.n ?? 0;
  }

  /**
   * Bounded list with optional filters, newest first. Limit is clamped to
   * [1, 500] and offset to >= 0 so a hostile query can never scan the table.
   */
  list(filter: AnalyticsListFilter = {}): AnalyticsLogRow[] {
    const limit = Math.min(500, Math.max(1, Math.floor(filter.limit ?? 100)));
    const offset = Math.max(0, Math.floor(filter.offset ?? 0));
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.sessionId && filter.sessionId.trim().length > 0) {
      where.push(`session_id = ?`);
      params.push(filter.sessionId.trim());
    }
    if (filter.provider && filter.provider.trim().length > 0) {
      where.push(`provider = ?`);
      params.push(filter.provider.trim());
    }
    if (filter.model && filter.model.trim().length > 0) {
      where.push(`model LIKE ?`);
      params.push(`%${filter.model.trim()}%`);
    }
    if (filter.status === "success" || filter.status === "error") {
      where.push(`status = ?`);
      params.push(filter.status);
    }
    if (filter.tokenSource === "provider" || filter.tokenSource === "estimated") {
      where.push(`token_source = ?`);
      params.push(filter.tokenSource);
    }
    if (filter.agentType && filter.agentType.trim().length > 0) {
      where.push(`agent_type = ?`);
      params.push(filter.agentType.trim());
    }
    if (filter.since != null && Number.isFinite(filter.since)) {
      where.push(`timestamp >= ?`);
      params.push(Math.floor(filter.since));
    }
    if (filter.search && filter.search.trim().length > 0) {
      const like = `%${filter.search.trim()}%`;
      where.push(`(model LIKE ? OR provider LIKE ? OR error_message LIKE ? OR message LIKE ?)`);
      params.push(like, like, like, like);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const stmt = this.db.prepare(
      `SELECT * FROM analytics_logs ${whereSql} ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`,
    );
    const rows = stmt.all(...params, limit, offset) as RawAnalyticsRow[];
    return rows.map(toRow);
  }

  /** Aggregate stats over the (optionally session/provider-filtered) log set. */
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
  } {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.sessionId && filter.sessionId.trim().length > 0) {
      where.push(`session_id = ?`);
      params.push(filter.sessionId.trim());
    }
    if (filter.provider && filter.provider.trim().length > 0) {
      where.push(`provider = ?`);
      params.push(filter.provider.trim());
    }
    if (filter.since != null && Number.isFinite(filter.since)) {
      where.push(`timestamp >= ?`);
      params.push(Math.floor(filter.since));
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM analytics_logs ${whereSql} ORDER BY timestamp DESC LIMIT 20000`)
      .all(...params) as RawAnalyticsRow[];

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
    const byProvider = new Map<
      string,
      { provider: string; requests: number; inputTokens: number; outputTokens: number; totalTokens: number; errors: number }
    >();
    const byModel = new Map<
      string,
      { model: string; provider: string; requests: number; totalTokens: number; errors: number }
    >();

    for (const row of rows) {
      if (row.status === "success") successCount += 1;
      else errorCount += 1;
      const input = row.input_tokens ?? 0;
      const output = row.output_tokens ?? 0;
      const total = row.total_tokens ?? input + output;
      totalInputTokens += input;
      totalOutputTokens += output;
      totalTokens += total;
      if (row.token_source === "provider") providerTokens += total;
      else if (row.token_source === "estimated") estimatedTokens += total;
      if (typeof row.cost_usd === "number" && Number.isFinite(row.cost_usd)) {
        totalCostUsd += row.cost_usd;
        hasCost = true;
      }
      if (typeof row.latency_ms === "number" && Number.isFinite(row.latency_ms)) {
        latencySum += row.latency_ms;
        latencyN += 1;
        if (minLatency === null || row.latency_ms < minLatency) minLatency = row.latency_ms;
        if (maxLatency === null || row.latency_ms > maxLatency) maxLatency = row.latency_ms;
      }
      const p = byProvider.get(row.provider) ?? {
        provider: row.provider,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        errors: 0,
      };
      p.requests += 1;
      p.inputTokens += input;
      p.outputTokens += output;
      p.totalTokens += total;
      if (row.status !== "success") p.errors += 1;
      byProvider.set(row.provider, p);

      const modelKey = `${row.provider}::${row.model}`;
      const m = byModel.get(modelKey) ?? {
        model: row.model,
        provider: row.provider,
        requests: 0,
        totalTokens: 0,
        errors: 0,
      };
      m.requests += 1;
      m.totalTokens += total;
      if (row.status !== "success") m.errors += 1;
      byModel.set(modelKey, m);
    }

    return {
      totalRequests: rows.length >= 20000 ? this.count() : rows.length,
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
    };
  }

  /** Distinct providers present in the log (for filter dropdowns). */
  distinctProviders(sessionId?: string): string[] {
    const rows =
      sessionId && sessionId.trim().length > 0
        ? (this.db
            .prepare(`SELECT DISTINCT provider FROM analytics_logs WHERE session_id = ? ORDER BY provider ASC`)
            .all(sessionId.trim()) as Array<{ provider: string }>)
        : (this.db
            .prepare(`SELECT DISTINCT provider FROM analytics_logs ORDER BY provider ASC`)
            .all() as Array<{ provider: string }>);
    return rows.map((r) => r.provider).filter((p) => typeof p === "string" && p.length > 0);
  }

  clear(sessionId?: string): void {
    if (sessionId && sessionId.trim().length > 0) {
      this.db.prepare(`DELETE FROM analytics_logs WHERE session_id = ?`).run(sessionId.trim());
    } else {
      this.db.prepare(`DELETE FROM analytics_logs`).run();
    }
  }

  /** Keep the table bounded: drop oldest rows beyond `keep` (default 20k). */
  prune(keep = 20000): void {
    try {
      const total = this.count();
      if (total <= keep) return;
      const drop = total - keep;
      this.db
        .prepare(
          `DELETE FROM analytics_logs WHERE id IN (
             SELECT id FROM analytics_logs ORDER BY timestamp ASC, id ASC LIMIT ?
           )`,
        )
        .run(drop);
    } catch {
      // Pruning is best-effort.
    }
  }
}
