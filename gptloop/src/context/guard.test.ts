import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ContextGuard } from "./guard.js";
import { SUMMARIZATION_SYSTEM_PROMPT } from "./summery/prompt.js";
import type { Provider, ChatCompletionOptions, StreamDelta } from "../agents/providers/types.js";
import type { StoredMessage } from "../services/sessionStore.js";

/** A fake provider: the summarizer call is recognized by its system prompt and returns a canned
 * summary; any other call streams a long response (used to cross the live threshold mid-stream). */
function fakeProvider(opts: { longResponseChars: number; summary?: string }): Provider {
  return {
    metadata: { id: "fake", label: "Fake", defaultBaseUrl: "https://example.invalid" },
    listModels: async () => [],
    async *streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<StreamDelta, void, unknown> {
      const first = options.messages[0] as { content?: unknown };
      const isSummarizer = first?.content === SUMMARIZATION_SYSTEM_PROMPT;
      if (isSummarizer) {
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { text: opts.summary ?? "A dense summary of the conversation." };
        return;
      }
      // The "main" call: stream in small chunks so onDelta is invoked many times, letting the
      // caller observe the live threshold crossing mid-stream.
      const chunk = "x".repeat(50);
      const total = Math.ceil(opts.longResponseChars / chunk.length);
      for (let i = 0; i < total; i++) {
        if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
        yield { text: chunk };
      }
    },
  };
}

function baseDeps(
  messages: StoredMessage[],
  overrides: Partial<ConstructorParameters<typeof ContextGuard>[0]> = {},
) {
  let current = messages;
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  const deps = {
    actor: { type: "main_agent" as const, id: "main", label: "Main agent" },
    settings: { mode: "sliding_window" as const, contextWindow: 1000, slidingWindowTruncateTokens: 5000 },
    getSystemPrompt: () => "system prompt",
    getMessages: () => current,
    setMessages: (next: StoredMessage[]) => {
      current = next;
    },
    provider: fakeProvider({ longResponseChars: 20_000 }),
    apiKey: "key",
    model: "fake-model",
    emit: (event: string, data: Record<string, unknown>) => events.push({ event, data }),
    ...overrides,
  };
  return { deps, events, getCurrent: () => current };
}

describe("ContextGuard — sliding window", () => {
  it("aborts the in-flight call and truncates once the live threshold is crossed mid-stream", async () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a".repeat(2000) },
      { role: "user", content: "current input" },
    ];
    const { deps, events, getCurrent } = baseDeps(messages);
    const guard = new ContextGuard(deps);
    guard.announce();

    const turnController = new AbortController();
    const outgoing: Array<Record<string, unknown>> = [
      { role: "system", content: "system prompt" },
      ...(messages as unknown as Array<Record<string, unknown>>),
    ];
    const callSignal = guard.beginCall(turnController.signal, outgoing);
    const stream = deps.provider.streamChatCompletion({
      apiKey: "key",
      model: "fake-model",
      messages: outgoing,
      tools: [],
      signal: callSignal,
    });

    let stopped = false;
    try {
      for await (const delta of stream) {
        if (await guard.onDelta(delta)) {
          stopped = true;
          break;
        }
      }
    } catch {
      // The provider throws once its own signal is aborted — acceptable either way.
      stopped = guard.pendingRetry;
    }

    assert.equal(stopped, true);
    assert.equal(guard.pendingRetry, true);
    assert.equal(callSignal.aborted, true, "the call-scoped signal must be aborted independently");
    assert.equal(turnController.signal.aborted, false, "the turn signal itself must NOT be aborted");

    const truncatedEvent = events.find((e) => e.event === "context_truncated");
    assert.ok(truncatedEvent, "a context_truncated event must be emitted");
    // The current user input must survive truncation.
    assert.ok(getCurrent().some((m) => m.content === "current input"));
  });

  it("emits context_usage events with percent derived from the configured contextWindow", async () => {
    const messages: StoredMessage[] = [{ role: "user", content: "hi" }];
    const { deps, events } = baseDeps(messages, {
      settings: { mode: "sliding_window", contextWindow: 1_000_000, slidingWindowTruncateTokens: 5000 },
      provider: fakeProvider({ longResponseChars: 200 }),
    });
    const guard = new ContextGuard(deps);
    const outgoing: Array<Record<string, unknown>> = [
      { role: "system", content: "system prompt" },
      ...(messages as unknown as Array<Record<string, unknown>>),
    ];
    const callSignal = guard.beginCall(new AbortController().signal, outgoing);
    const stream = deps.provider.streamChatCompletion({
      apiKey: "key",
      model: "fake-model",
      messages: outgoing,
      tools: [],
      signal: callSignal,
    });
    for await (const delta of stream) {
      await guard.onDelta(delta);
    }
    const usageEvents = events.filter((e) => e.event === "context_usage");
    assert.ok(usageEvents.length > 0);
    for (const e of usageEvents) {
      assert.equal(e.data.context_window, 1_000_000);
      assert.ok((e.data.percent as number) >= 0 && (e.data.percent as number) <= 1);
    }
  });

  it("is a no-op when contextWindow is unset (<=0)", async () => {
    const messages: StoredMessage[] = [{ role: "user", content: "hi" }];
    const { deps, events } = baseDeps(messages, {
      settings: { mode: "sliding_window", contextWindow: 0, slidingWindowTruncateTokens: 5000 },
    });
    const guard = new ContextGuard(deps);
    guard.announce();
    await guard.checkBeforeCall();
    assert.equal(events.length, 0, "no events should be emitted when the window is unknown");
  });
});

describe("ContextGuard — auto summarization", () => {
  it("replaces the context with a summary when the threshold is crossed, preserving the current input", async () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "past question" },
      { role: "assistant", content: "a".repeat(1000) },
      { role: "user", content: "the current ask" },
    ];
    const { deps, events, getCurrent } = baseDeps(messages, {
      settings: { mode: "summarize", contextWindow: 1000, slidingWindowTruncateTokens: 5000 },
      provider: fakeProvider({ longResponseChars: 20_000, summary: "CONDENSED SUMMARY TEXT" }),
    });
    const guard = new ContextGuard(deps);
    const outgoing: Array<Record<string, unknown>> = [
      { role: "system", content: "system prompt" },
      ...(messages as unknown as Array<Record<string, unknown>>),
    ];
    const callSignal = guard.beginCall(new AbortController().signal, outgoing);
    const stream = deps.provider.streamChatCompletion({
      apiKey: "key",
      model: "fake-model",
      messages: outgoing,
      tools: [],
      signal: callSignal,
    });
    for await (const delta of stream) {
      if (await guard.onDelta(delta)) break;
    }

    assert.equal(guard.pendingRetry, true);
    const started = events.find((e) => e.event === "context_summarization_started");
    const completed = events.find((e) => e.event === "context_summarization_completed");
    assert.ok(started, "context_summarization_started must be emitted");
    assert.ok(completed, "context_summarization_completed must be emitted");

    const finalMessages = getCurrent();
    assert.equal(finalMessages.length, 2, "summary message + current user input only");
    assert.ok(String(finalMessages[0]!.content).includes("CONDENSED SUMMARY TEXT"));
    assert.equal(finalMessages[1]!.content, "the current ask");
    // Past data must be gone from the live context.
    assert.ok(!finalMessages.some((m) => m.content === "past question"));
  });

  it("falls back to truncation when the summarizer call fails", async () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "past question" },
      { role: "assistant", content: "a".repeat(1000) },
      { role: "user", content: "the current ask" },
    ];
    const failingProvider: Provider = {
      metadata: { id: "fake", label: "Fake", defaultBaseUrl: "https://example.invalid" },
      listModels: async () => [],
      async *streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<StreamDelta, void, unknown> {
        const first = options.messages[0] as { content?: unknown };
        if (first?.content === SUMMARIZATION_SYSTEM_PROMPT) {
          throw new Error("summarizer provider exploded");
        }
        yield { text: "x".repeat(20_000) };
      },
    };
    const { deps, events, getCurrent } = baseDeps(messages, {
      settings: { mode: "summarize", contextWindow: 1000, slidingWindowTruncateTokens: 5000 },
      provider: failingProvider,
    });
    const guard = new ContextGuard(deps);
    const outgoing: Array<Record<string, unknown>> = [
      { role: "system", content: "system prompt" },
      ...(messages as unknown as Array<Record<string, unknown>>),
    ];
    const callSignal = guard.beginCall(new AbortController().signal, outgoing);
    const stream = deps.provider.streamChatCompletion({
      apiKey: "key",
      model: "fake-model",
      messages: outgoing,
      tools: [],
      signal: callSignal,
    });
    for await (const delta of stream) {
      if (await guard.onDelta(delta)) break;
    }

    assert.ok(events.some((e) => e.event === "context_summarization_failed"));
    assert.ok(events.some((e) => e.event === "context_truncated" && e.data.fallback === true));
    // The current user input must still have survived the fallback truncation.
    assert.ok(getCurrent().some((m) => m.content === "the current ask"));
  });
});
