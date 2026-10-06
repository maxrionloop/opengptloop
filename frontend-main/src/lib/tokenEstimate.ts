import type { ChatMessage, TeamAgentSegment, ToolActivity } from "@/types";

/**
 * Live (client-side) token estimator for the context meter.
 *
 * Mirrors the backend engine in `gptloop/src/tokens.ts` so the circle + popup
 * can increment *simultaneously* with the streamed text the user already sees:
 * every `token` / `reasoning` SSE delta lands in the zustand store via
 * `StreamBatcher` (rAF-coalesced, ~once per frame), and the meter derives its
 * figure from that same store state — no polling lag, no extra SSE traffic.
 *
 * Heuristic (kept identical to the backend on purpose):
 * - Base rate ~4 chars per token for Latin scripts.
 * - Words guard: at least ~0.75 tokens per whitespace-separated word.
 * - CJK (Han/Hiragana/Katakana/Hangul/Fullwidth) chars count ~1 token each.
 * - Per-message overhead +3 tokens (role + framing), +3 priming for the reply.
 * - Tool payloads (args/result JSON, sub-agent + team output) are counted as
 *   text because the backend transcript stores the same payloads as tool
 *   messages — so tool calls visibly grow the meter mid-turn as well.
 *
 * This is an *estimate* shown live. The authoritative figure remains the
 * backend `GET /api/analytics/context` value (provider-counted actual when the
 * provider reported usage). `ContextMeter` combines both: backend base +
 * system/tools overhead, plus the live transcript growth — converging to the
 * authoritative count when the turn settles.
 *
 * Never throws: malformed / oversized payloads degrade to 0 for that part.
 */

export const TOKENS_PER_MESSAGE = 3;
export const CHARS_PER_TOKEN = 4;
export const TOKENS_PER_WORD = 0.75;

/** True for CJK code points counted as ~1 token each (same ranges as backend). */
function isCjk(charCode: number): boolean {
  return (
    (charCode >= 0x4e00 && charCode <= 0x9fff) || // CJK Unified Ideographs
    (charCode >= 0x3400 && charCode <= 0x4dbf) || // CJK Extension A
    (charCode >= 0x3040 && charCode <= 0x309f) || // Hiragana
    (charCode >= 0x30a0 && charCode <= 0x30ff) || // Katakana
    (charCode >= 0xac00 && charCode <= 0xd7af) || // Hangul Syllables
    (charCode >= 0xff00 && charCode <= 0xffef) // Fullwidth forms
  );
}

/**
 * Estimate tokens for a plain string. Empty/blank text costs 0.
 * Never throws — non-strings yield 0.
 */
export function estimateTextTokens(text: unknown): number {
  if (typeof text !== "string" || text.length === 0) return 0;
  try {
    let cjk = 0;
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);
      if (isCjk(code)) cjk += 1;
    }
    const nonCjkChars = text.length - cjk;
    const byChars = Math.ceil(nonCjkChars / CHARS_PER_TOKEN);
    const trimmed = text.trim();
    const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
    const byWords = Math.ceil(words * TOKENS_PER_WORD);
    return cjk + Math.max(byChars, byWords);
  } catch {
    return 0;
  }
}

/** Safely stringify an untrusted tool payload for counting (capped to avoid blowups). */
function payloadText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    const json = JSON.stringify(value);
    // Cap single-payload scans: beyond ~200k chars the char/4 rate dominates and
    // the extra precision is not worth the per-frame cost while streaming.
    return typeof json === "string" && json.length > 200_000 ? json.slice(0, 200_000) : (json ?? "");
  } catch {
    return "";
  }
}

function estimateToolTokens(tool: ToolActivity): number {
  try {
    let tokens = 1; // framing per call (mirrors backend +1 per tool-call entry)
    tokens += estimateTextTokens(tool.name ?? "");
    if (tool.args !== undefined) tokens += estimateTextTokens(payloadText(tool.args));
    if (tool.result !== undefined) {
      // Backend stores the tool response as its own message (+3 framing) — count it here
      // so the meter grows the moment a tool_result lands in the store.
      tokens += TOKENS_PER_MESSAGE + estimateTextTokens(payloadText(tool.result));
    }
    if (tool.subAgent) {
      tokens += estimateTextTokens(tool.subAgent.output ?? "");
      tokens += estimateTextTokens(tool.subAgent.reasoning ?? "");
      for (const nested of tool.subAgent.tools ?? []) {
        tokens += estimateToolTokens(nested);
      }
    }
    if (tool.multiRuns) {
      for (const run of Object.values(tool.multiRuns)) {
        if (!run) continue;
        tokens += estimateTextTokens(run.output ?? "");
        tokens += estimateTextTokens(run.reasoning ?? "");
        for (const nested of run.tools ?? []) {
          tokens += estimateToolTokens(nested);
        }
      }
    }
    return tokens;
  } catch {
    return 0;
  }
}

function estimateTeamSegmentTokens(segment: TeamAgentSegment): number {
  try {
    let tokens = TOKENS_PER_MESSAGE;
    tokens += estimateTextTokens(segment.output ?? "");
    tokens += estimateTextTokens(segment.reasoning ?? "");
    for (const tool of segment.tools ?? []) {
      tokens += estimateToolTokens(tool);
    }
    return tokens;
  } catch {
    return 0;
  }
}

/**
 * Estimate tokens for one frontend chat message (content + reasoning + tools +
 * live team runs). Mirrors backend `estimateMessageTokens` (+3 per message).
 */
export function estimateFrontendMessageTokens(message: ChatMessage): number {
  try {
    let tokens = TOKENS_PER_MESSAGE;
    tokens += estimateTextTokens(message.content ?? "");
    if (message.reasoning) tokens += estimateTextTokens(message.reasoning);
    for (const tool of message.tools ?? []) {
      tokens += estimateToolTokens(tool);
    }
    const team = message.team;
    if (team) {
      for (const agentId of team.order ?? []) {
        const block = team.agents?.[agentId];
        if (!block) continue;
        for (const segment of block.segments ?? []) {
          tokens += estimateTeamSegmentTokens(segment);
        }
      }
    }
    return tokens;
  } catch {
    return TOKENS_PER_MESSAGE;
  }
}

/**
 * Estimate tokens for a full frontend transcript (all messages + priming).
 * This is the live counterpart of the backend `transcriptTokens` figure.
 */
export function estimateLiveTranscriptTokens(messages: ChatMessage[] | undefined | null): number {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  let total = 0;
  try {
    for (const message of messages) {
      if (!message || typeof message !== "object") continue;
      // A fresh streaming assistant message starts empty — it still costs framing,
      // which estimateFrontendMessageTokens already includes.
      total += estimateFrontendMessageTokens(message);
    }
    // +3 tokens priming for the assistant reply (mirrors backend convention).
    return total + 3;
  } catch {
    return total;
  }
}
