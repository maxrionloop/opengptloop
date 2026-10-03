/**
 * Token estimation. GPTLoop talks to many different providers (OpenAI-compatible REST, each with
 * its own tokenizer) with zero LLM SDKs and no tokenizer dependency today (see src/agents/providers
 * — every call is a raw fetch). Pulling in a provider-specific tokenizer (tiktoken, etc.) would only
 * be accurate for ONE provider and silently wrong for the rest, including every custom/self-added
 * provider this app supports. Instead we use the same pragmatic heuristic the codebase already
 * relies on for budgeting (see MAX_CONTEXT_CHARS/MAX_MESSAGE_CHARS in src/agents/subagents.ts):
 * ~4 characters per token, which is a well-known, reasonably accurate average for English text and
 * JSON across modern tokenizers. It is intentionally conservative-leaning so context management
 * triggers a little early rather than a little late.
 */
const CHARS_PER_TOKEN = 4;

/** A small fixed overhead per message to account for role/field envelope tokens. */
const PER_MESSAGE_OVERHEAD_TOKENS = 4;

export function estimateTextTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Same heuristic as {@link estimateTextTokens}, taking a character count directly (hot paths that
 * only track a running character counter, e.g. live stream accumulation, avoid allocating a string). */
export function estimateCharsAsTokens(chars: number): number {
  if (chars <= 0) return 0;
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/** Estimate tokens for a StoredMessage-shaped `content` field (string, multimodal parts, or null). */
export function estimateContentTokens(content: unknown): number {
  if (content == null) return 0;
  if (typeof content === "string") return estimateTextTokens(content);
  if (Array.isArray(content)) {
    let total = 0;
    for (const part of content) {
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") {
          total += estimateTextTokens(text);
          continue;
        }
        // Non-text parts (e.g. image_url) — a small flat cost, they are never subject to
        // char-based truncation here and contribute negligibly to the budget by design.
        total += 16;
      }
    }
    return total;
  }
  return 0;
}

/** Minimal shape shared by StoredMessage and the wire (provider) message format. */
export interface EstimableMessage {
  content?: unknown;
  reasoning_content?: unknown;
  tool_calls?: unknown;
  name?: unknown;
}

/** Estimate the total tokens one message contributes to a provider request. */
export function estimateMessageTokens(message: EstimableMessage): number {
  let total = estimateContentTokens(message.content);
  if (typeof message.reasoning_content === "string") {
    total += estimateTextTokens(message.reasoning_content);
  }
  if (message.tool_calls) {
    try {
      total += estimateTextTokens(JSON.stringify(message.tool_calls));
    } catch {
      // Non-serializable tool_calls should never happen; ignore defensively.
    }
  }
  if (typeof message.name === "string") total += estimateTextTokens(message.name);
  return total + PER_MESSAGE_OVERHEAD_TOKENS;
}

/** Estimate the total tokens of an array of StoredMessage/wire-format messages. */
export function estimateMessagesTokens(messages: readonly EstimableMessage[]): number {
  let total = 0;
  for (const message of messages) total += estimateMessageTokens(message);
  return total;
}

/** Estimate the total tokens of a full provider request: system prompt + conversation messages. */
export function estimateRequestTokens(
  systemPrompt: string,
  messages: readonly EstimableMessage[],
): number {
  return estimateTextTokens(systemPrompt) + estimateMessagesTokens(messages);
}
