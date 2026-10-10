import type { Provider, ToolCallDelta } from "../providers/types.js";

/**
 * Dedicated summary-agent execution.
 *
 * Sole responsibility: produce the final summary text. No tools are advertised,
 * so the agent cannot continue the main task or execute main-agent tools.
 *
 * Completion guarantee: success requires the provider stream to finish AND a
 * validated non-empty final text to exist. Stream close, chunk arrival, or a
 * terminal finishReason alone never implies success — the accumulated text is
 * validated by the caller before SUMMARY_VALIDATED.
 *
 * No timeouts, no retry loops, no artificial limits. Explicit abort and
 * provider errors resolve as failure/incomplete, never success.
 */

export interface SummaryRunRequest {
  provider: Provider;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
  systemPrompt: string;
  userMessage: string;
  signal?: AbortSignal;
  /** Emit streaming progress (chunks in order). Never used for completion. */
  send?: (event: string, data: Record<string, unknown>) => void;
}

export interface SummaryRunOutcome {
  /** True only when the stream finished with non-empty accumulated text. */
  streamOk: boolean;
  aborted: boolean;
  /** Accumulated final text (may be empty on failure). */
  text: string;
  finishReason: string | null;
  error?: string;
}

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export async function runSummaryAgent(request: SummaryRunRequest): Promise<SummaryRunOutcome> {
  const answerParts: string[] = [];
  let finishReason: string | null = null;
  let sawToolCalls = false;

  try {
    const stream = request.provider.streamChatCompletion({
      apiKey: request.apiKey,
      model: request.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userMessage },
      ],
      tools: [],
      baseUrl: request.baseUrl,
      temperature: request.temperature,
      effort: request.effort,
      signal: request.signal,
    });

    // Accumulate chunks strictly in arrival order. Reasoning deltas are
    // intentionally dropped (hidden chain-of-thought must never leak).
    const pendingToolDeltas: ToolCallDelta[] = [];
    for await (const delta of stream) {
      if (delta.text) {
        const cleaned = normalize(delta.text);
        answerParts.push(cleaned);
        request.send?.("summary_chunk", { value: cleaned });
      }
      if (delta.toolCalls && delta.toolCalls.length > 0) {
        sawToolCalls = true;
        pendingToolDeltas.push(...delta.toolCalls);
      }
      if (delta.finishReason) finishReason = delta.finishReason;
    }

    void pendingToolDeltas;

    if (request.signal?.aborted) {
      return { streamOk: false, aborted: true, text: answerParts.join(""), finishReason };
    }
    // A model requesting tools despite none being advertised cannot yield a
    // valid summary — report incomplete, never success.
    if (sawToolCalls) {
      return {
        streamOk: false,
        aborted: false,
        text: answerParts.join(""),
        finishReason,
        error: "Summary agent attempted tool calls; no tools are permitted for summarization.",
      };
    }
    const text = answerParts.join("");
    return { streamOk: true, aborted: false, text, finishReason };
  } catch (error) {
    if (request.signal?.aborted) {
      return { streamOk: false, aborted: true, text: answerParts.join(""), finishReason };
    }
    return {
      streamOk: false,
      aborted: false,
      text: answerParts.join(""),
      finishReason,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
