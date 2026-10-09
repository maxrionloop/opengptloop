import type { MainContextUsage, SSEEventData } from "@/types";
import { findActiveCustomAgent } from "@/lib/customAgents";
import { activeCeo } from "@/lib/defaultCeo";
import { activeTeam } from "@/lib/defaultTeams";
import { MAIN_AGENT_ID } from "@/lib/customAgents";

/** Scope tag carried by `context_usage` log events (see backend agents/agent.ts). */
export const MAIN_AGENT_SCOPE = "main" as const;

/**
 * Minimal store shape needed to decide whether the built-in Main Agent is the agent
 * serving chat turns. Mirrors the turn-routing logic in `hooks/useChatStream.ts`
 * (`buildStartRequest`): chat mode, Custom Agents, CEO mode, and team mode each route
 * away from the Main Agent. Kept as a structural subset so additional agents can be
 * added later without rewriting callers.
 */
interface MainAgentState {
  agentMode: string;
  activeCustomAgentId: string | null;
  customAgents: Array<{ id: string }>;
  settings: { enableCeoAgents?: string; enableAgentTeams?: string };
  ceoAgents: Array<{ id: string; enabled?: boolean; name?: string }>;
  agentTeams: Array<{ id: string; enabled?: boolean }>;
}

/**
 * True when a chat turn would run as the built-in Main Agent: agent mode is on, no
 * Custom Agent is selected, and neither CEO nor team mode would take over. Uses the
 * same resolvers as turn construction (`findActiveCustomAgent` / `activeCeo` /
 * `activeTeam`) rather than brittle UI checks, so the button and the backend's
 * `agent: "main"` log tag agree on what "main" means.
 */
export function isMainAgentActive(s: MainAgentState): boolean {
  if (s.agentMode === "chat") return false;
  if (s.activeCustomAgentId && s.activeCustomAgentId !== MAIN_AGENT_ID) {
    if (findActiveCustomAgent(s.customAgents as never, s.activeCustomAgentId)) return false;
    // Unknown/stale custom-agent id: fall through to the remaining checks so a dangling
    // selection still hides the meter only when another agent actually takes over.
  }
  if (s.settings.enableCeoAgents === "yes" && activeCeo(s.ceoAgents as never)) return false;
  if (s.settings.enableAgentTeams === "yes" && activeTeam(s.agentTeams as never)) return false;
  return true;
}

/** True for a finite, non-negative token count (zero is legitimate; NaN/negative is not). */
function cleanCount(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/**
 * Validate + normalize a raw `context_usage` log-event payload into store-ready usage.
 * Returns null for anything that must not be displayed: wrong scope (custom/sub/team
 * agents), missing prompt count with no fallback, or malformed counts. Never throws.
 * Separation point between token-data extraction and popup presentation.
 */
export function normalizeContextUsageEvent(data: SSEEventData): Omit<MainContextUsage, "updatedAt"> | null {
  try {
    const scope = typeof data.agent === "string" ? data.agent.trim().toLowerCase() : "";
    // Only the main agent's log feeds the meter. Other scopes ("custom", ...) are valid
    // log data for future agents — ignored here, never shown as main-agent usage.
    if (scope !== MAIN_AGENT_SCOPE) return null;
    const promptTokens = cleanCount(data.prompt_tokens);
    // Without a prompt count there is no current-context size to show. Completion-only
    // payloads are not a substitute (they measure output, not context).
    if (promptTokens === undefined) return null;
    const out: Omit<MainContextUsage, "updatedAt"> = { promptTokens };
    const completionTokens = cleanCount(data.completion_tokens);
    if (completionTokens !== undefined) out.completionTokens = completionTokens;
    const totalTokens = cleanCount(data.total_tokens);
    if (totalTokens !== undefined) out.totalTokens = totalTokens;
    if (typeof data.provider === "string" && data.provider.trim().length > 0) {
      out.provider = data.provider.trim().slice(0, 120);
    }
    if (typeof data.model === "string" && data.model.trim().length > 0) {
      out.model = data.model.trim().slice(0, 200);
    }
    const iteration = cleanCount(data.iteration);
    if (iteration !== undefined) out.iteration = iteration;
    return out;
  } catch {
    return null;
  }
}

/** Format a token count with thousands separators, e.g. 12345 → "12,345". */
export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  try {
    return Math.floor(n).toLocaleString("en-US");
  } catch {
    return String(Math.floor(n));
  }
}

/** Compact token count for tight UI, e.g. 12345 → "12.3K", 2000000 → "2M". */
export function formatTokenCompact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const v = Math.floor(n);
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k >= 100 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const m = v / 1_000_000;
  return `${m >= 100 ? Math.round(m).toString() : m.toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * Utilization percentage of `used` relative to the model's context-window `limit`.
 * Returns null when the limit is missing/invalid (callers show the count without a
 * percentage rather than inventing one). Clamped to 0–100 and rounded to 1 decimal.
 */
export function contextPercent(used: number, limit: number | null | undefined): number | null {
  if (!Number.isFinite(used) || used < 0) return null;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) return null;
  const pct = (used / limit) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}
