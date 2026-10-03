/**
 * Shared types + tunables for LLM context-window management.
 *
 * Two strategies are available (see ../context/summery and ../context/sliding-window):
 *  - "summarize"      — Auto context summarization. When the live context hits
 *                        SUMMARIZATION_TRIGGER_PERCENT, the running agent is paused, a fresh,
 *                        stateless "summarizer" agent condenses the conversation, and the live
 *                        context is replaced with the summary before the turn resumes.
 *  - "sliding_window" — When the live context hits SLIDING_WINDOW_TRIGGER_PERCENT, the oldest
 *                        eligible tokens are deleted (never the newest) so the agent can keep
 *                        working indefinitely without ever hard-stopping on a context-length error.
 *
 * Both strategies share the same trigger mechanics (see guard.ts): they estimate token usage as
 * the model streams its response and, the instant the threshold is crossed (even mid-stream), the
 * in-flight request is aborted, the context is compacted, and the SAME turn transparently retries
 * with the freshly compacted context — the end user only sees a brief "compacting context" step.
 */

/** The two selectable context-management strategies. "off" disables all management (used only
 * when the effective context window could not be resolved at all, e.g. defensive fallback). */
export type ContextManagementMode = "summarize" | "sliding_window";

/** System default: Auto context summarization is selected unless the user chooses otherwise. */
export const DEFAULT_CONTEXT_MANAGEMENT_MODE: ContextManagementMode = "summarize";

/** Auto context summarization triggers once the live context reaches 92% of the model's window. */
export const SUMMARIZATION_TRIGGER_PERCENT = 0.92;

/** Sliding-window truncation triggers once the live context reaches 99% of the model's window. */
export const SLIDING_WINDOW_TRIGGER_PERCENT = 0.99;

/** Default amount of (estimated) tokens removed per sliding-window truncation pass. User-configurable. */
export const DEFAULT_SLIDING_WINDOW_TRUNCATE_TOKENS = 5000;

/** Hard bounds for the user-configurable sliding-window truncation amount. */
export const MIN_SLIDING_WINDOW_TRUNCATE_TOKENS = 500;
export const MAX_SLIDING_WINDOW_TRUNCATE_TOKENS = 200_000;

/**
 * Which kind of actor a given ContextGuard instance is protecting. Carried on every emitted
 * event so one chat's event stream can host many independently-managed contexts at once (a
 * multi-agent team's leader + members, a CEO + its teams, sub-agents, ...).
 */
export type ContextActorType =
  | "main_agent"
  | "custom_agent"
  | "chat"
  | "sub_agent"
  | "team_leader"
  | "team_member"
  | "ceo";

/** Identifies the actor (agent) a context-management event/usage snapshot belongs to. */
export interface ContextActorInfo {
  type: ContextActorType;
  /** Stable id for this actor within the chat (e.g. the sub-agent run id, team member name). */
  id: string;
  /** Human-readable label shown in the UI (e.g. "Main agent", "Niko (member)"). */
  label: string;
}

/** Fully-resolved context-management configuration for one turn/actor. */
export interface ContextManagementSettings {
  mode: ContextManagementMode;
  /**
   * The effective context window (in tokens) for the active model. Resolved by the frontend from
   * provider-reported model metadata, or — when a provider does not publish metadata — a value the
   * user entered manually and confirmed (see Settings). `0`/negative means "unknown": the guard
   * becomes a no-op (no usage tracking, no compaction) rather than guessing and risking a bad cut.
   */
  contextWindow: number;
  /** How many (estimated) tokens to remove per sliding-window pass. Default 5000. */
  slidingWindowTruncateTokens: number;
}

/** Build a ContextManagementSettings with the documented defaults applied to missing/invalid input. */
export function normalizeContextManagementSettings(input: {
  mode?: unknown;
  contextWindow?: unknown;
  slidingWindowTruncateTokens?: unknown;
}): ContextManagementSettings {
  const mode: ContextManagementMode = input.mode === "sliding_window" ? "sliding_window" : "summarize";
  const windowRaw =
    typeof input.contextWindow === "number"
      ? input.contextWindow
      : typeof input.contextWindow === "string"
        ? Number(input.contextWindow)
        : NaN;
  const contextWindow = Number.isFinite(windowRaw) && windowRaw > 0 ? Math.floor(windowRaw) : 0;
  const truncateRaw =
    typeof input.slidingWindowTruncateTokens === "number"
      ? input.slidingWindowTruncateTokens
      : typeof input.slidingWindowTruncateTokens === "string"
        ? Number(input.slidingWindowTruncateTokens)
        : NaN;
  const slidingWindowTruncateTokens = Number.isFinite(truncateRaw)
    ? Math.min(MAX_SLIDING_WINDOW_TRUNCATE_TOKENS, Math.max(MIN_SLIDING_WINDOW_TRUNCATE_TOKENS, Math.floor(truncateRaw)))
    : DEFAULT_SLIDING_WINDOW_TRUNCATE_TOKENS;
  return { mode, contextWindow, slidingWindowTruncateTokens };
}
