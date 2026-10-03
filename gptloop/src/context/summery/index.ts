import type { Provider } from "../../agents/providers/types.js";
import type { StoredMessage } from "../../services/sessionStore.js";
import { estimateMessagesTokens } from "../estimator.js";
import { stripInjectedContextBlocks } from "../contextTags.js";
import { extractMessageText, findCurrentUserInputIndex } from "../messageUtils.js";
import { buildSummarizableExtract } from "./extract.js";
import { runSummaryAgent } from "./runner.js";

export { buildSummarizableExtract } from "./extract.js";
export { runSummaryAgent } from "./runner.js";
export { SUMMARIZATION_SYSTEM_PROMPT } from "./prompt.js";

export interface AutoSummarizationParams {
  messages: readonly StoredMessage[];
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
  signal?: AbortSignal;
  /**
   * Returns a freshly-built `<persistent_memory>...` block (and, when present, the knowledge-base
   * notice) to re-attach after compaction, exactly as if this were the first message of a new
   * conversation. Omitted for runtimes that have no memory concept (e.g. sub-agents).
   */
  getMemoryBlock?: () => string;
  onLog?: (message: string) => void;
}

export interface AutoSummarizationResult {
  /** The brand-new, compacted message array: [summaryMessage, currentUserInputMessage]. */
  messages: StoredMessage[];
  beforeTokens: number;
  afterTokens: number;
  summaryChars: number;
  summarizedMessageCount: number;
}

/**
 * Run one full auto-summarization pass:
 *  1. Locate the current user input (the last user-role message) — it is excluded from the
 *     extract and carried over unchanged (minus any stale memory/knowledge block).
 *  2. Build the summarizable extract (past user inputs + assistant data + tool calls/results,
 *     reasoning and memory/knowledge already excluded).
 *  3. Run a brand-new, stateless summarizer agent on the extract.
 *  4. Replace the entire live context with exactly two messages: a synthetic message carrying the
 *     fresh memory block (if any) + the summary, followed by the untouched current user input.
 */
export async function runAutoSummarization(
  params: AutoSummarizationParams,
): Promise<AutoSummarizationResult> {
  const messages = params.messages;
  const beforeTokens = estimateMessagesTokens(messages);
  const currentUserInputIndex = findCurrentUserInputIndex(messages);

  if (currentUserInputIndex === -1) {
    // Defensive: should never happen (every turn pushes a user message before the loop starts).
    // Nothing safe to do — return the input unchanged so the caller can fall back to truncation.
    return {
      messages: messages.map((m) => ({ ...m })),
      beforeTokens,
      afterTokens: beforeTokens,
      summaryChars: 0,
      summarizedMessageCount: 0,
    };
  }

  params.onLog?.("Collecting conversation history to summarize (memory, reasoning, and the current input are excluded)...");
  const extract = buildSummarizableExtract(messages, currentUserInputIndex);
  params.onLog?.(`Found ${extract.messageCount} message(s) to fold into the summary.`);

  const currentUserInput = messages[currentUserInputIndex]!;
  const cleanedCurrentUserInput: StoredMessage = {
    ...currentUserInput,
    content:
      typeof currentUserInput.content === "string"
        ? stripInjectedContextBlocks(currentUserInput.content)
        : currentUserInput.content,
  };

  if (extract.messageCount === 0) {
    // Nothing to summarize (e.g. the very first turn already blew the budget on its own) — keep
    // just the current user input, dropping nothing else since there is nothing else.
    const result = [cleanedCurrentUserInput];
    return {
      messages: result,
      beforeTokens,
      afterTokens: estimateMessagesTokens(result),
      summaryChars: 0,
      summarizedMessageCount: 0,
    };
  }

  const summary = await runSummaryAgent(extract.text, {
    provider: params.provider,
    apiKey: params.apiKey,
    model: params.model,
    baseUrl: params.baseUrl,
    temperature: params.temperature,
    effort: params.effort,
    signal: params.signal,
    onLog: params.onLog,
  });

  params.onLog?.("Rebuilding context from the summary (re-attaching memory and the current input)...");
  const memoryBlock = params.getMemoryBlock?.()?.trim() ?? "";
  const summaryMessage: StoredMessage = {
    role: "user",
    content: [memoryBlock, `<conversation_summary>\n${summary}\n</conversation_summary>`]
      .filter((part) => part.length > 0)
      .join("\n\n"),
  };

  const resultMessages = [summaryMessage, cleanedCurrentUserInput];
  return {
    messages: resultMessages,
    beforeTokens,
    afterTokens: estimateMessagesTokens(resultMessages),
    summaryChars: summary.length,
    summarizedMessageCount: extract.messageCount,
  };
}

/** Re-exported for callers that only need plain text extraction (e.g. tests). */
export function extractText(content: StoredMessage["content"]): string {
  return extractMessageText(content);
}
