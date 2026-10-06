import type { CustomProvider, ModelInfo } from "@/types";
import { isCustomProviderId } from "@/lib/providers";

/**
 * Manual LLM context-window limits.
 *
 * When a provider's `/models` catalog returns no metadata (`context_window`
 * is null/missing), the user must enter the limit manually (e.g. "250k",
 * "1m"). Confirmed values live in `settings.manualContextLimits`, keyed by
 * `${providerId}::${modelId}`, and are persisted to SQLite with the rest of
 * the settings document.
 */

/** Default preloaded manual limit (250k) used when no metadata exists. */
export const DEFAULT_MANUAL_CONTEXT_LIMIT = 250_000;

/** Storage key for one provider+model pair. */
export function contextLimitKey(providerId: string, modelId: string): string {
  return `${(providerId ?? "").trim()}::${(modelId ?? "").trim()}`;
}

/**
 * Parse a user-entered context limit like "250k", "1m", "1.5M", "200000".
 * - "k" suffix = thousand, "m" suffix = million (case-insensitive).
 * - Commas/underscores/spaces and a trailing "tokens" word are ignored.
 * Returns the token count, or null when unparseable / out of range.
 */
export function parseContextLimitInput(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  let text = String(raw).trim().toLowerCase();
  if (!text) return null;
  // Allow "250k tokens", "1m tokens", "250 k", "1,000,000", "1_000_000".
  text = text.replace(/tokens?$/i, "").trim();
  text = text.replace(/[,_\s]+/g, "");
  if (!text) return null;
  let multiplier = 1;
  const last = text[text.length - 1];
  if (last === "k" || last === "m") {
    multiplier = last === "k" ? 1_000 : 1_000_000;
    text = text.slice(0, -1);
  }
  if (!text || !/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text) * multiplier;
  if (!Number.isFinite(value) || value <= 0) return null;
  const floored = Math.floor(value);
  // Guard against absurd values (1k .. 100M tokens).
  if (floored < 1_000 || floored > 100_000_000) return null;
  return floored;
}

/** Format a token count back to short input form ("250k", "1m", "128000"). */
export function formatContextLimitInput(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "";
  const n = Math.floor(tokens);
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000}m`;
  if (n >= 1_000_000 && n % 100_000 === 0) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}m`;
  }
  if (n >= 1_000 && n % 1_000 === 0) return `${n / 1_000}k`;
  if (n >= 1_000 && n % 100 === 0) {
    const v = n / 1_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}k`;
  }
  return String(n);
}

/** Format a token count for display ("250k tokens", "1.5M tokens"). */
export function formatContextTokens(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${Number.isInteger(v) ? v : v.toFixed(1)}k`;
  }
  return String(Math.floor(n));
}

/** Normalize an untrusted manual-limits record from storage. */
export function normalizeManualContextLimits(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !key.includes("::")) continue;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n >= 1_000 && n <= 100_000_000) {
      out[key] = Math.floor(n);
    }
  }
  return out;
}

/**
 * Resolve the effective context-window total for the active provider+model:
 * provider metadata first, then the user's confirmed manual limit.
 * Returns null when neither is known.
 */
export function resolveContextLimit(args: {
  providerId: string;
  modelId: string;
  models: ModelInfo[];
  customProviders: CustomProvider[];
  manualLimits: Record<string, number>;
}): { limit: number | null; source: "provider" | "manual" | null } {
  const providerId = (args.providerId ?? "").trim();
  const modelId = (args.modelId ?? "").trim();
  if (!providerId || !modelId) return { limit: null, source: null };

  if (!isCustomProviderId(providerId)) {
    const match =
      args.models.find((m) => m.id === modelId && m.provider === providerId) ??
      args.models.find((m) => m.id === modelId);
    if (typeof match?.context_window === "number" && match.context_window > 0) {
      return { limit: Math.floor(match.context_window), source: "provider" };
    }
  } else {
    // Custom providers carry no catalog metadata by design; still honor a
    // manual limit saved for this exact provider+model pair.
    void args.customProviders;
  }

  const manual = args.manualLimits[contextLimitKey(providerId, modelId)];
  if (typeof manual === "number" && Number.isFinite(manual) && manual > 0) {
    return { limit: Math.floor(manual), source: "manual" };
  }
  return { limit: null, source: null };
}

/**
 * Whether the manual-limit input must be shown: a model is selected but no
 * provider metadata advertises its window. Applies to built-in AND custom
 * providers (custom models never have catalog metadata).
 */
export function needsManualContextLimit(args: {
  providerId: string;
  modelId: string;
  models: ModelInfo[];
}): boolean {
  const providerId = (args.providerId ?? "").trim();
  const modelId = (args.modelId ?? "").trim();
  if (!providerId || !modelId) return false;
  if (isCustomProviderId(providerId)) return true;
  const match =
    args.models.find((m) => m.id === modelId && m.provider === providerId) ??
    args.models.find((m) => m.id === modelId);
  if (!match) return true;
  return !(typeof match.context_window === "number" && match.context_window > 0);
}
