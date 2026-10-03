import type { StoredMessage } from "../../services/sessionStore.js";
import { stripInjectedContextBlocks } from "../contextTags.js";
import { extractMessageText } from "../messageUtils.js";

/** Per-message cap so one pathological tool result cannot blow out the summarizer's own context. */
const MAX_MESSAGE_CHARS = 6000;

export interface SummarizableExtract {
  /** The rendered transcript text handed to the summarization agent. Empty when nothing to summarize. */
  text: string;
  /** How many source messages were folded into the extract. */
  messageCount: number;
}

/**
 * Build the text handed to the summarization agent from the live conversation, per spec:
 * INCLUDED — data (assistant content, excluding reasoning), tool calls (including their results),
 *            and every past user input.
 * EXCLUDED — the system prompt (never part of this array), reasoning tokens (`reasoning_content`
 *            is simply never read here), persistent-memory/knowledge-base blocks (stripped out of
 *            any message text), and the current user input (the message at `currentUserInputIndex`,
 *            skipped entirely — it is re-attached unchanged after compaction).
 */
export function buildSummarizableExtract(
  messages: readonly StoredMessage[],
  currentUserInputIndex: number,
): SummarizableExtract {
  const sections: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (i === currentUserInputIndex) continue;
    const message = messages[i]!;
    const rendered = renderMessage(message);
    if (rendered) sections.push(rendered);
  }
  return { text: sections.join("\n\n"), messageCount: sections.length };
}

function renderMessage(message: StoredMessage): string {
  switch (message.role) {
    case "system":
      return ""; // never present in this array, but defensive
    case "user": {
      const text = clean(message.content);
      return text ? `## Past user input\n${text}` : "";
    }
    case "assistant": {
      const parts: string[] = [];
      const text = clean(message.content);
      if (text) parts.push(text);
      const toolCallLines = (message.tool_calls ?? [])
        .map((call) => describeToolCall(call))
        .filter((line): line is string => Boolean(line));
      if (toolCallLines.length > 0) parts.push(`Requested tool call(s):\n${toolCallLines.join("\n")}`);
      return parts.length > 0 ? `## Assistant\n${parts.join("\n")}` : "";
    }
    case "tool": {
      const text = clean(message.content);
      return text ? `## Tool result (${message.name ?? "tool"})\n${text}` : "";
    }
    default:
      return "";
  }
}

function describeToolCall(call: Record<string, unknown>): string | undefined {
  const fn = call.function as { name?: unknown; arguments?: unknown } | undefined;
  const name = typeof fn?.name === "string" ? fn.name : undefined;
  if (!name) return undefined;
  const args = typeof fn?.arguments === "string" ? truncate(fn.arguments, 1000) : "";
  return args ? `- ${name}(${args})` : `- ${name}()`;
}

function clean(content: StoredMessage["content"]): string {
  const text = stripInjectedContextBlocks(extractMessageText(content)).trim();
  return truncate(text, MAX_MESSAGE_CHARS);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}… [truncated]`;
}
