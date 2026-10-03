import type { Provider, StreamDelta } from "../agents/providers/types.js";
import type { StoredMessage } from "../services/sessionStore.js";
import { estimateCharsAsTokens, estimateMessagesTokens, estimateRequestTokens } from "./estimator.js";
import { applySlidingWindowTruncation } from "./sliding-window/truncate.js";
import { runAutoSummarization } from "./summery/index.js";
import {
  SLIDING_WINDOW_TRIGGER_PERCENT,
  SUMMARIZATION_TRIGGER_PERCENT,
  type ContextActorInfo,
  type ContextManagementSettings,
} from "./types.js";

/** Minimum time between two "live usage" SSE emissions for the SAME call, in ms (~6-7/sec). */
const LIVE_EMIT_THROTTLE_MS = 150;

export interface ContextGuardDeps {
  actor: ContextActorInfo;
  settings: ContextManagementSettings;
  getSystemPrompt: () => string;
  getMessages: () => StoredMessage[];
  setMessages: (next: StoredMessage[]) => void;
  /** Builds a fresh `<persistent_memory>`(+knowledge) block to re-attach after summarization. */
  getMemoryBlock?: () => string;
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  effort?: string;
  emit: (event: string, data: Record<string, unknown>) => void;
}

/**
 * One ContextGuard instance manages ONE actor's live context (the main agent, a custom agent, chat
 * mode, one sub-agent run, one team member/leader, the CEO, ...). Each actor's loop creates its own
 * instance (they never share state) and drives it at three points per iteration — see the inline
 * usage example at the bottom of this file, mirrored across every integrated loop:
 *
 *   const guard = new ContextGuard({ ...deps });
 *   guard.announce();
 *   while (true) {
 *     await guard.checkBeforeCall();                      // (1) proactive, between iterations
 *     const outgoing = buildProviderMessages(...);
 *     const callSignal = guard.beginCall(turnSignal, outgoing);
 *     try {
 *       const stream = provider.streamChatCompletion({ ..., signal: callSignal });
 *       for await (const delta of stream) {
 *         ...existing per-delta handling...
 *         if (await guard.onDelta(delta)) break;           // (2) live, mid-stream
 *       }
 *     } catch (error) {
 *       if (guard.pendingRetry) continue;                  // (3) swallow the guard-triggered abort
 *       ...existing error handling...
 *     }
 *     if (guard.pendingRetry) continue;                    // stream ended cleanly post-abort
 *     ...existing tool-call / final-answer handling...
 *   }
 */
export class ContextGuard {
  /** Set to true for the duration of a guard-triggered compaction + the retry that follows it. */
  pendingRetry = false;

  private callController: AbortController | null = null;
  private baseTokensThisCall = 0;
  private liveResponseChars = 0;
  private lastLiveEmitAt = 0;
  private announced = false;

  constructor(private readonly deps: ContextGuardDeps) {}

  private get active(): boolean {
    return this.deps.settings.contextWindow > 0;
  }

  private triggerPercent(): number {
    return this.deps.settings.mode === "sliding_window"
      ? SLIDING_WINDOW_TRIGGER_PERCENT
      : SUMMARIZATION_TRIGGER_PERCENT;
  }

  /** Emit the resolved mode/limit once per turn so the UI knows what it is watching. Idempotent. */
  announce(): void {
    if (this.announced) return;
    this.announced = true;
    if (!this.active) return;
    this.deps.emit("context_mode_resolved", {
      actor: this.deps.actor,
      mode: this.deps.settings.mode,
      context_window: this.deps.settings.contextWindow,
      sliding_window_truncate_tokens: this.deps.settings.slidingWindowTruncateTokens,
    });
  }

  /**
   * Call once at the top of every loop iteration, BEFORE building the outgoing provider message
   * array. Proactively compacts when the conversation is already past the threshold going into the
   * next request (e.g. a large tool result was just appended) — this is what lets the agent "stop
   * no matter what" even between calls, not only mid-stream.
   */
  async checkBeforeCall(): Promise<void> {
    if (!this.active) return;
    const used = estimateRequestTokens(this.deps.getSystemPrompt(), this.deps.getMessages());
    const percent = used / this.deps.settings.contextWindow;
    this.emitUsage(used, percent, true);
    if (percent >= this.triggerPercent()) {
      await this.compact(`context reached ${(percent * 100).toFixed(1)}% before the next request`);
    }
  }

  /**
   * Begin one streaming call. Returns the AbortSignal to pass to `streamChatCompletion` — linked to
   * the turn's own signal (a genuine turn-abort still cancels it) but independently abortable by
   * THIS guard the instant the live threshold is crossed, without aborting the whole turn.
   */
  beginCall(turnSignal: AbortSignal, outgoingMessages: Array<Record<string, unknown>>): AbortSignal {
    this.pendingRetry = false;
    this.liveResponseChars = 0;
    this.callController = new AbortController();
    if (turnSignal.aborted) this.callController.abort();
    else turnSignal.addEventListener("abort", () => this.callController?.abort(), { once: true });
    this.baseTokensThisCall = this.active ? estimateMessagesTokens(outgoingMessages) : 0;
    return this.callController.signal;
  }

  /**
   * Call after handling each streamed delta (reasoning/text/tool-call-argument chunk). Tracks the
   * growing response size live so the UI's token counter increments in sync with generation, not
   * only once the response finishes. Returns true the instant the active threshold is crossed: the
   * caller MUST stop consuming the stream immediately (the in-flight call has already been aborted
   * and a compaction pass is already complete by the time this resolves).
   */
  async onDelta(delta: StreamDelta): Promise<boolean> {
    if (!this.active || this.pendingRetry) return this.pendingRetry;

    if (delta.text) this.liveResponseChars += delta.text.length;
    if (delta.reasoning) this.liveResponseChars += delta.reasoning.length;
    if (delta.toolCalls) {
      for (const call of delta.toolCalls) {
        if (call.function?.arguments) this.liveResponseChars += call.function.arguments.length;
        if (call.function?.name) this.liveResponseChars += call.function.name.length;
      }
    }

    const used = this.baseTokensThisCall + estimateCharsAsTokens(this.liveResponseChars);
    const percent = used / this.deps.settings.contextWindow;
    this.emitUsage(used, percent, false);

    if (percent >= this.triggerPercent()) {
      this.pendingRetry = true;
      this.callController?.abort();
      await this.compact(`context reached ${(percent * 100).toFixed(1)}% mid-response`);
    }
    return this.pendingRetry;
  }

  private emitUsage(usedTokens: number, percent: number, settled: boolean): void {
    const now = Date.now();
    if (!settled && now - this.lastLiveEmitAt < LIVE_EMIT_THROTTLE_MS) return;
    this.lastLiveEmitAt = now;
    this.deps.emit("context_usage", {
      actor: this.deps.actor,
      used_tokens: usedTokens,
      context_window: this.deps.settings.contextWindow,
      percent: Math.max(0, Math.min(1, percent)),
      mode: this.deps.settings.mode,
    });
  }

  private async compact(reason: string): Promise<void> {
    if (this.deps.settings.mode === "summarize") {
      await this.summarize(reason);
    } else {
      this.truncate(reason, false);
    }
  }

  private async summarize(reason: string): Promise<void> {
    const { emit, actor } = this.deps;
    const messages = this.deps.getMessages();
    const beforeTokens = estimateRequestTokens(this.deps.getSystemPrompt(), messages);

    emit("context_summarization_started", {
      actor,
      reason,
      before_tokens: beforeTokens,
      context_window: this.deps.settings.contextWindow,
    });

    try {
      const result = await runAutoSummarization({
        messages,
        provider: this.deps.provider,
        apiKey: this.deps.apiKey,
        model: this.deps.model,
        baseUrl: this.deps.baseUrl,
        temperature: this.deps.temperature,
        effort: this.deps.effort,
        getMemoryBlock: this.deps.getMemoryBlock,
        onLog: (message) => emit("context_summarization_log", { actor, message }),
      });
      this.deps.setMessages(result.messages);
      const afterTokens = estimateRequestTokens(this.deps.getSystemPrompt(), result.messages);
      emit("context_summarization_completed", {
        actor,
        before_tokens: beforeTokens,
        after_tokens: afterTokens,
        summary_chars: result.summaryChars,
        summarized_message_count: result.summarizedMessageCount,
      });
    } catch (error) {
      emit("context_summarization_failed", {
        actor,
        error: error instanceof Error ? error.message : String(error),
      });
      // Safety net: a failed summarization call must never leave the turn permanently stuck over
      // budget — fall back to sliding-window truncation so the agent can still make progress.
      this.truncate(reason, true);
    }
  }

  private truncate(reason: string, isFallback: boolean): void {
    const { emit, actor } = this.deps;
    const messages = this.deps.getMessages();
    const outcome = applySlidingWindowTruncation(messages, this.deps.settings.slidingWindowTruncateTokens);
    this.deps.setMessages(outcome.messages);
    emit("context_truncated", {
      actor,
      reason,
      fallback: isFallback,
      before_tokens: outcome.beforeTokensEstimate,
      after_tokens: outcome.afterTokensEstimate,
      removed_tokens: outcome.removedTokensEstimate,
      removed_messages: outcome.removedMessageCount,
      stripped_reasoning_messages: outcome.strippedReasoningCount,
    });
  }
}
