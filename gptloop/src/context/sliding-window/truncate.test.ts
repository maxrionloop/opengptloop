import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySlidingWindowTruncation } from "./truncate.js";
import type { StoredMessage } from "../../services/sessionStore.js";

describe("applySlidingWindowTruncation", () => {
  it("never removes user messages (past or current)", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "first user message" },
      { role: "assistant", content: "a".repeat(4000) },
      { role: "user", content: "second (current) user input" },
    ];
    const outcome = applySlidingWindowTruncation(messages, 100_000);
    const roles = outcome.messages.map((m) => m.role);
    assert.ok(roles.includes("user"));
    assert.equal(outcome.messages.filter((m) => m.role === "user").length, 2);
    assert.equal(outcome.messages[0]!.content, "first user message");
    assert.equal(outcome.messages[outcome.messages.length - 1]!.content, "second (current) user input");
  });

  it("strips reasoning_content from the oldest assistant messages first", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "old answer", reasoning_content: "x".repeat(400) },
      { role: "user", content: "u2" },
    ];
    // Small budget: only enough to strip the reasoning, not delete a whole message.
    const outcome = applySlidingWindowTruncation(messages, 50);
    assert.equal(outcome.strippedReasoningCount, 1);
    assert.equal(outcome.removedMessageCount, 0);
    const assistant = outcome.messages.find((m) => m.role === "assistant")!;
    assert.equal(assistant.reasoning_content, undefined);
    assert.equal(assistant.content, "old answer"); // content itself untouched
  });

  it("deletes the OLDEST deletable messages first, never the newest", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "OLDEST assistant turn" },
      { role: "assistant", content: "NEWEST assistant turn" },
    ];
    // Budget big enough to force at least one whole-message deletion, but not both.
    const outcome = applySlidingWindowTruncation(messages, 6);
    const contents = outcome.messages.map((m) => m.content);
    assert.ok(!contents.includes("OLDEST assistant turn"), "oldest content should be gone");
    assert.ok(contents.includes("NEWEST assistant turn"), "newest content must survive");
  });

  it("never splits an assistant-with-tool_calls message from its tool results", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "u1" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_1", type: "function", function: { name: "f", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "call_1", name: "f", content: "x".repeat(2000) },
      { role: "assistant", content: "final answer" },
    ];
    // Budget equal to the tool-call group's own estimated size (assistant 23 + tool 505 = 528
    // tokens), so only that oldest group is removed — the final answer (newer) must survive.
    const outcome = applySlidingWindowTruncation(messages, 528);
    // Either the whole tool-call group survives, or it is gone entirely — never half of it.
    const hasAssistantToolCall = outcome.messages.some((m) => m.role === "assistant" && m.tool_calls);
    const hasToolResult = outcome.messages.some((m) => m.role === "tool" && m.tool_call_id === "call_1");
    assert.equal(hasAssistantToolCall, hasToolResult);
    // The final answer and the user message are always protected/kept.
    assert.ok(outcome.messages.some((m) => m.content === "final answer"));
    assert.ok(outcome.messages.some((m) => m.content === "u1"));
  });

  it("reports before/after/removed token estimates consistently", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a".repeat(4000) },
      { role: "user", content: "u2" },
    ];
    const outcome = applySlidingWindowTruncation(messages, 500);
    assert.equal(outcome.beforeTokensEstimate - outcome.afterTokensEstimate, outcome.removedTokensEstimate);
    assert.ok(outcome.afterTokensEstimate <= outcome.beforeTokensEstimate);
  });

  it("is a no-op when the target is 0", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a" },
    ];
    const outcome = applySlidingWindowTruncation(messages, 0);
    assert.equal(outcome.removedMessageCount, 0);
    assert.equal(outcome.strippedReasoningCount, 0);
    assert.deepEqual(
      outcome.messages.map((m) => m.content),
      messages.map((m) => m.content),
    );
  });
});
