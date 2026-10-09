import { API_ROUTES, routeUrl } from "@/app/api/routes";
import { resilientFetch } from "@/lib/net";

/**
 * Raw-context viewer support — Main Agent only (extensible to other agents).
 *
 * The backend's `GET /api/sessions/:id/context` returns the exact provider-format
 * inputs the Main Agent's next request is built from: the resolved system prompt
 * plus the untruncated transcript (user / assistant / tool messages, including
 * tool calls/results). This module is the single integration point for that
 * endpoint so additional agents can be supported later by widening
 * `SUPPORTED_RAW_CONTEXT_AGENTS` and the backend scope gate — callers stay unchanged.
 */

/** Agent scopes the raw-context endpoint serves. Main-only today; extend to add agents. */
export const SUPPORTED_RAW_CONTEXT_AGENTS = ["main"] as const;
export type SupportedRawContextAgent = (typeof SUPPORTED_RAW_CONTEXT_AGENTS)[number];

/** Agent id accepted by the raw-context helpers. Kept as `string` so future agents plug in. */
export type RawContextAgent = string;

/** The Main Agent scope tag used by default. */
export const MAIN_RAW_CONTEXT_AGENT = "main" as const;

/** Where the returned transcript came from. */
export type RawContextSource = "live" | "persisted" | "empty";

/** One provider-format message, passed through untouched (raw). */
export interface RawContextMessage {
  role: string;
  content?: unknown;
  [key: string]: unknown;
}

/** Normalized raw context for one session + agent. */
export interface MainRawContext {
  agent: RawContextAgent;
  sessionId: string;
  systemPrompt: string | null;
  systemPromptSource: "custom" | "builtin";
  messages: RawContextMessage[];
  source: RawContextSource;
  messageCount: number;
  /** Latest main-agent `context_usage` log entry, when the session has one. */
  usage?: Record<string, unknown> | null;
  fetchedAt: number;
}

/**
 * True when `agent` is a supported raw-context scope. Case-insensitive, trims input.
 * Today only `"main"` passes — other agents are valid future scopes, rejected here
 * (and by the backend) so they can never be shown as Main Agent context.
 */
export function isSupportedRawContextAgent(agent: unknown): agent is SupportedRawContextAgent {
  if (typeof agent !== "string") return false;
  return (SUPPORTED_RAW_CONTEXT_AGENTS as readonly string[]).includes(agent.trim().toLowerCase());
}

/** Human label for an agent scope in the raw-context UI. Extensible per agent. */
export function rawContextAgentLabel(agent: RawContextAgent): string {
  if (typeof agent === "string" && agent.trim().toLowerCase() === MAIN_RAW_CONTEXT_AGENT) {
    return "Main agent";
  }
  const trimmed = typeof agent === "string" ? agent.trim() : "";
  return trimmed.length > 0 ? trimmed : "Agent";
}

function asMessages(raw: unknown): RawContextMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: RawContextMessage[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && typeof (item as { role?: unknown }).role === "string") {
      out.push(item as RawContextMessage);
    }
  }
  return out;
}

/**
 * Fetch one session's raw context for `agent` (default `"main"`).
 *
 * - Resolves 404 (unknown session) to an empty context so fresh local-only threads
 *   render "No context yet" instead of an error. Transient failures (network,
 *   backend restarting, 5xx) THROW — callers must not mistake them for empty.
 * - Never throws on malformed payloads: unknown shapes normalize to an empty context.
 */
export async function fetchMainRawContext(
  sessionId: string,
  options?: { agent?: RawContextAgent; signal?: AbortSignal },
): Promise<MainRawContext> {
  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!id) throw new Error("A session id is required.");
  const agent = (options?.agent ?? MAIN_RAW_CONTEXT_AGENT).trim() || MAIN_RAW_CONTEXT_AGENT;
  if (!isSupportedRawContextAgent(agent)) {
    throw new Error(`Only the main agent is supported at this stage (got "${agent}").`);
  }

  const url = routeUrl(API_ROUTES.sessionContext, {
    params: { id },
    query: { agent: agent.toLowerCase() },
  });
  const res = await resilientFetch(url, { cache: "no-store" }, { signal: options?.signal });
  if (res.status === 404) {
    return {
      agent: agent.toLowerCase(),
      sessionId: id,
      systemPrompt: null,
      systemPromptSource: "builtin",
      messages: [],
      source: "empty",
      messageCount: 0,
      usage: null,
      fetchedAt: Date.now(),
    };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  const record = (data ?? {}) as Record<string, unknown>;
  const messages = asMessages(record.messages);
  const source: RawContextSource =
    record.source === "live" || record.source === "persisted" || record.source === "empty"
      ? record.source
      : messages.length > 0
        ? "persisted"
        : "empty";
  const systemPrompt = typeof record.systemPrompt === "string" ? record.systemPrompt : null;
  return {
    agent: typeof record.agent === "string" ? record.agent : agent.toLowerCase(),
    sessionId: typeof record.sessionId === "string" ? record.sessionId : id,
    systemPrompt,
    systemPromptSource: record.systemPromptSource === "custom" ? "custom" : "builtin",
    messages,
    source,
    messageCount:
      typeof record.messageCount === "number" && Number.isFinite(record.messageCount)
        ? Math.max(0, Math.floor(record.messageCount))
        : messages.length,
    usage:
      record.usage && typeof record.usage === "object"
        ? (record.usage as Record<string, unknown>)
        : null,
    fetchedAt:
      typeof record.fetchedAt === "number" && Number.isFinite(record.fetchedAt)
        ? record.fetchedAt
        : Date.now(),
  };
}

/**
 * Serialize a raw context to its display form: pretty-printed JSON of the exact
 * payload (system prompt + messages + metadata), unformatted otherwise — no
 * markdown, no trimming, no redaction — so the original content is preserved
 * as accurately as possible. Never throws.
 */
export function formatRawContextPayload(ctx: MainRawContext): string {
  try {
    return JSON.stringify(
      {
        agent: ctx.agent,
        sessionId: ctx.sessionId,
        source: ctx.source,
        systemPromptSource: ctx.systemPromptSource,
        systemPrompt: ctx.systemPrompt,
        messageCount: ctx.messageCount,
        messages: ctx.messages,
        usage: ctx.usage ?? null,
        fetchedAt: ctx.fetchedAt,
      },
      null,
      2,
    );
  } catch {
    return "{}";
  }
}

/** Approximate display size of the raw payload (chars), for the modal stats row. */
export function rawContextCharCount(ctx: MainRawContext): number {
  try {
    return formatRawContextPayload(ctx).length;
  } catch {
    return 0;
  }
}
