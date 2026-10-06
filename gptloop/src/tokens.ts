/**
 * Universal token counter engine (provider-agnostic, dependency-free).
 *
 * Why this exists: many AI providers do NOT return token usage in their
 * streaming responses. Because "tokens used in chat session" is important,
 * this engine estimates tokens locally whenever the provider supplies no
 * actual counts. It is NOT a real tokenizer — it works for ANY provider by
 * approximating with character/word heuristics plus per-message overhead.
 *
 * Contract (used by the centralized analytics service):
 * - When a provider returns actual usage, analytics MUST use it and mark
 *   `tokenSource: "provider"`.
 * - Only when the provider returns nothing usable, analytics falls back to
 *   this engine and marks `tokenSource: "estimated"`.
 * - The dashboard clearly distinguishes the two sources per log row.
 *
 * Heuristic (documented, deterministic, fast — O(n) in input length):
 * - Base rate: ~4 characters per token for Latin scripts (the widely used
 *   OpenAI approximation: 1 token ≈ 4 chars ≈ 0.75 words).
 * - Words guard: at least ~0.75 tokens per whitespace-separated word, so very
 *   short words ("a I am") don't collapse to zero.
 * - CJK scripts (Chinese/Japanese/Korean): each Han/Hiragana/Katakana/Hangul
 *   character carries more meaning per glyph — counted as ~1 token each, with
 *   the remainder of the text counted at the Latin rate.
 * - Per-message overhead: +3 tokens per chat message (role + framing, mirrors
 *   OpenAI's tiktoken guidance) and +1 per tool-call entry when present.
 * - Tool schemas: serialized to JSON and counted as text plus a small
 *   per-tool overhead (+8 tokens each for name/description framing).
 *
 * These numbers are approximations. They are stable and good enough for
 * cost/latency dashboards, and they are ALWAYS labeled "estimated" in the UI.
 */

/** Tokens added per chat message for role/framing overhead. */
export const TOKENS_PER_MESSAGE = 3;
/** Tokens added per tool schema for name/description framing. */
export const TOKENS_PER_TOOL = 8;
/** Average characters per token for Latin-script text. */
export const CHARS_PER_TOKEN = 4;
/** Tokens per whitespace-separated word (floor guard). */
export const TOKENS_PER_WORD = 0.75;

/** True for CJK code points counted as ~1 token each. */
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
  let cjk = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (isCjk(code)) cjk += 1;
  }
  const nonCjkChars = text.length - cjk;
  const byChars = Math.ceil(nonCjkChars / CHARS_PER_TOKEN);
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  const byWords = Math.ceil(words * TOKENS_PER_WORD);
  return cjk + Math.max(byChars, byWords);
}

/** Extract plain text from OpenAI-style message content (string | parts | null). */
export function contentToText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (part == null) continue;
      if (typeof part === "string") {
        parts.push(part);
        continue;
      }
      if (typeof part === "object") {
        const record = part as Record<string, unknown>;
        const text = record.text;
        if (typeof text === "string") {
          parts.push(text);
          continue;
        }
        // Image parts carry no countable text but cost framing; count a fixed stub.
        const type = record.type;
        if (type === "image_url" || (record.image_url != null && record.image_url !== undefined)) {
          parts.push("[image]");
          continue;
        }
        const nested = record.content;
        if (typeof nested === "string") parts.push(nested);
      }
    }
    return parts.join(" ");
  }
  return String(content);
}

/** Estimate tokens for one chat message (content + role/tool overhead). */
export function estimateMessageTokens(message: Record<string, unknown>): number {
  let tokens = TOKENS_PER_MESSAGE;
  try {
    tokens += estimateTextTokens(contentToText(message.content));
    const reasoning = message.reasoning_content;
    if (typeof reasoning === "string" && reasoning.length > 0) {
      tokens += estimateTextTokens(reasoning);
    }
    const toolCalls = message.tool_calls;
    if (Array.isArray(toolCalls)) {
      for (const call of toolCalls) {
        tokens += 1; // framing per call
        if (call && typeof call === "object") {
          const fn = (call as Record<string, unknown>).function as
            | Record<string, unknown>
            | undefined;
          if (fn) {
            if (typeof fn.name === "string") tokens += estimateTextTokens(fn.name);
            if (typeof fn.arguments === "string") tokens += estimateTextTokens(fn.arguments);
          }
        }
      }
    }
    if (typeof message.tool_call_id === "string") tokens += 1;
    if (typeof message.name === "string" && message.name.length > 0) tokens += 1;
  } catch {
    // Estimation must never throw on malformed messages.
  }
  return tokens;
}

/** Estimate prompt tokens for a full provider message list. */
export function estimateMessagesTokens(messages: Array<Record<string, unknown>>): number {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  let total = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    total += estimateMessageTokens(message);
  }
  // +3 tokens priming for the assistant reply (mirrors tiktoken convention).
  return total + 3;
}

/** Estimate tokens for the advertised tool schemas (JSON-serialized). */
export function estimateToolsTokens(tools: unknown): number {
  if (!Array.isArray(tools) || tools.length === 0) return 0;
  let total = 0;
  for (const tool of tools) {
    total += TOKENS_PER_TOOL;
    try {
      total += estimateTextTokens(JSON.stringify(tool));
    } catch {
      // Skip unserializable schemas.
    }
  }
  return total;
}

/**
 * Estimate the full prompt (input) size for one LLM call:
 * system + conversation messages + advertised tool schemas.
 */
export function estimatePromptTokens(
  messages: Array<Record<string, unknown>>,
  tools?: unknown,
): number {
  return estimateMessagesTokens(messages) + estimateToolsTokens(tools);
}

/** Estimate completion (output) tokens from streamed text + reasoning. */
export function estimateCompletionTokens(text: string, reasoning?: string): number {
  let total = estimateTextTokens(text);
  if (typeof reasoning === "string" && reasoning.length > 0) {
    total += estimateTextTokens(reasoning);
  }
  return total;
}

/** Split totals into the canonical { input, output, total } triple. */
export function toTokenTriple(
  inputTokens: number,
  outputTokens: number,
): { inputTokens: number; outputTokens: number; totalTokens: number } {
  const input = Math.max(0, Math.floor(inputTokens));
  const output = Math.max(0, Math.floor(outputTokens));
  return { inputTokens: input, outputTokens: output, totalTokens: input + output };
}
