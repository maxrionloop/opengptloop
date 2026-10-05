/**
 * Built-in token counter — a fast, provider-agnostic APPROXIMATION.
 *
 * This is intentionally NOT a real BPE/tiktoken tokenizer. It carries no model
 * vocabularies, downloads nothing, and never allocates per-token. It exists for
 * ONE purpose: when a provider/model does not report real usage in its response,
 * the analytics layer still needs a reasonable token estimate so the dashboard
 * can show how much a chat session is consuming. Any provider that DOES return
 * real usage bypasses this entirely (see analytics/instrumentation.ts).
 *
 * Accuracy target: within a sensible margin of real BPE tokenizers for mixed
 * English / code / punctuation / CJK text. The estimate blends two classic
 * rules of thumb and counts CJK & symbol glyphs individually:
 *   - ~4 characters per token (OpenAI's English rule of thumb)
 *   - ~1.33 tokens per whitespace-delimited word
 * The two are averaged, which tracks real tokenizers more closely than either
 * rule alone across prose and source code.
 *
 * Everything here is pure, synchronous, and defensive: it never throws on weird
 * input (numbers, nested arrays, nulls) so it can run on the hot path safely.
 */

/** Rough per-message framing overhead (role markers, delimiters) — mirrors OpenAI's heuristic. */
const PER_MESSAGE_OVERHEAD = 4;
/** Priming tokens the model adds before the assistant reply. */
const REPLY_PRIMING = 3;
/** Flat estimate for an image part in a multimodal message (real cost is model-specific). */
const IMAGE_PART_TOKENS = 300;

/** The estimated usage for one request when the provider does not report real numbers. */
export interface EstimatedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * True for codepoints that most tokenizers treat as ~1 token each: CJK ideographs,
 * Japanese kana, Hangul, and common full-width / symbol / emoji ranges. Counting
 * these 1:1 keeps the character-based estimate from badly under-counting CJK text.
 */
function isGlyphToken(code: number): boolean {
  return (
    (code >= 0x3040 && code <= 0x30ff) || // Hiragana + Katakana
    (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0xac00 && code <= 0xd7af) || // Hangul syllables
    (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
    (code >= 0xff00 && code <= 0xffef) || // Full-width forms
    code >= 0x1f000 // Emoji / symbols / supplementary planes
  );
}

/**
 * Estimate the number of tokens in a piece of text. Returns 0 for empty input and
 * never throws — non-string input is coerced to a string first.
 */
export function countTextTokens(input: unknown): number {
  if (input == null) return 0;
  const text = typeof input === "string" ? input : safeStringify(input);
  if (text.length === 0) return 0;
  if (text.trim().length === 0) {
    // Whitespace-only still costs a little in most tokenizers.
    return Math.max(1, Math.ceil(text.length / 6));
  }

  let glyphTokens = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code !== undefined && isGlyphToken(code)) glyphTokens += 1;
  }

  // Characters not already counted as 1:1 glyph tokens.
  const remainingChars = Math.max(0, text.length - glyphTokens);
  const words = text.split(/\s+/).filter((w) => w.length > 0).length;

  const byChars = remainingChars / 4;
  const byWords = words * 1.33;
  const blended = (byChars + byWords) / 2;

  const estimate = glyphTokens + Math.round(blended);
  return Math.max(estimate, glyphTokens, 1);
}

/** Count the tokens contributed by a single tool call (function name + JSON arguments). */
export function countToolCallTokens(toolCall: unknown): number {
  if (!toolCall || typeof toolCall !== "object") return 0;
  const record = toolCall as Record<string, unknown>;
  const fn = (record.function as Record<string, unknown> | undefined) ?? undefined;
  const name = typeof fn?.name === "string" ? fn.name : "";
  const args =
    typeof fn?.arguments === "string" ? fn.arguments : fn?.arguments != null ? safeStringify(fn.arguments) : "";
  // +4 framing tokens for the tool-call envelope.
  return countTextTokens(name) + countTextTokens(args) + 4;
}

/** Extract the plain text from a message `content` field (string, multimodal array, or null). */
function contentTokens(content: unknown): number {
  if (content == null) return 0;
  if (typeof content === "string") return countTextTokens(content);
  if (Array.isArray(content)) {
    let total = 0;
    for (const part of content) {
      if (typeof part === "string") {
        total += countTextTokens(part);
        continue;
      }
      if (part && typeof part === "object") {
        const record = part as Record<string, unknown>;
        const type = typeof record.type === "string" ? record.type : "";
        if (type.includes("image") || record.image_url != null || record.image != null) {
          total += IMAGE_PART_TOKENS;
          continue;
        }
        const text = record.text ?? record.content ?? "";
        total += countTextTokens(text);
      }
    }
    return total;
  }
  return countTextTokens(safeStringify(content));
}

/**
 * Estimate the tokens for one provider-format message (OpenAI wire shape). Accounts for
 * role, content (incl. multimodal parts), tool calls, tool name / id, and reasoning.
 */
export function countMessageTokens(message: unknown): number {
  if (!message || typeof message !== "object") return PER_MESSAGE_OVERHEAD;
  const record = message as Record<string, unknown>;

  let total = PER_MESSAGE_OVERHEAD;
  if (typeof record.role === "string") total += countTextTokens(record.role);
  total += contentTokens(record.content);
  if (typeof record.name === "string") total += countTextTokens(record.name);
  if (typeof record.reasoning_content === "string") total += countTextTokens(record.reasoning_content);

  if (Array.isArray(record.tool_calls)) {
    for (const call of record.tool_calls) total += countToolCallTokens(call);
  }
  return total;
}

/** Estimate the total prompt tokens for a full provider-format message array. */
export function countMessagesTokens(messages: unknown): number {
  if (!Array.isArray(messages)) return 0;
  let total = REPLY_PRIMING;
  for (const message of messages) total += countMessageTokens(message);
  return total;
}

/**
 * Estimate full request usage: input tokens from the prompt messages and output tokens
 * from the assistant's streamed answer, reasoning, and tool-call arguments. Used only as
 * a fallback when the provider does not report real usage.
 */
export function estimateUsage(params: {
  messages: unknown;
  outputText?: string;
  reasoningText?: string;
  toolCalls?: unknown[];
}): EstimatedUsage {
  const inputTokens = countMessagesTokens(params.messages);

  let outputTokens = 0;
  if (params.outputText) outputTokens += countTextTokens(params.outputText);
  if (params.reasoningText) outputTokens += countTextTokens(params.reasoningText);
  if (Array.isArray(params.toolCalls)) {
    for (const call of params.toolCalls) outputTokens += countToolCallTokens(call);
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/** JSON.stringify that never throws (falls back to String()). */
function safeStringify(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  } catch {
    try {
      return String(value);
    } catch {
      return "";
    }
  }
}
