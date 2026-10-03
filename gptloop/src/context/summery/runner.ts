import type { Provider } from "../../agents/providers/types.js";
import { SUMMARIZATION_SYSTEM_PROMPT, buildSummarizationUserMessage } from "./prompt.js";

export interface RunSummaryAgentParams {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
  /** Aborts the summarization call too (e.g. the user cancelled the whole turn/chat). */
  signal?: AbortSignal;
  /** Human-readable progress lines for the UI (e.g. "Calling the summarization model..."). */
  onLog?: (message: string) => void;
}

/**
 * Run a brand-new, single-shot "summarizer" agent: a fresh conversation (system prompt + exactly
 * one user message, the extract) with NO tools and NO memory of any previous summarization run —
 * every invocation starts completely clean, per spec. Uses the SAME provider/model/credentials the
 * live agent is currently using, so the summary is produced by the same LLM the conversation is
 * running on. Returns the final summary text only (reasoning deltas, if any, are surfaced solely as
 * progress logs — never included in the returned summary).
 */
export async function runSummaryAgent(
  extractText: string,
  params: RunSummaryAgentParams,
): Promise<string> {
  params.onLog?.("Starting a fresh summarization agent (no prior summarization history)...");
  const stream = params.provider.streamChatCompletion({
    apiKey: params.apiKey,
    model: params.model,
    messages: [
      { role: "system", content: SUMMARIZATION_SYSTEM_PROMPT },
      { role: "user", content: buildSummarizationUserMessage(extractText) },
    ],
    tools: [],
    baseUrl: params.baseUrl,
    temperature: params.temperature,
    effort: params.effort,
    signal: params.signal,
  });

  params.onLog?.("Calling the summarization model...");
  const parts: string[] = [];
  let reasoningSeen = false;
  for await (const delta of stream) {
    if (delta.reasoning && !reasoningSeen) {
      reasoningSeen = true;
      params.onLog?.("Summarization model is reasoning (discarded — only the final summary is kept)...");
    }
    if (delta.text) parts.push(delta.text);
  }

  const summary = parts.join("").trim();
  if (!summary) {
    throw new Error("The summarization agent returned an empty summary.");
  }
  params.onLog?.(`Summary received (${summary.length} chars).`);
  return summary;
}
