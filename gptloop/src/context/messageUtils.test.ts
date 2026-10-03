import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findCurrentUserInputIndex, extractMessageText } from "./messageUtils.js";
import type { StoredMessage } from "../services/sessionStore.js";

describe("findCurrentUserInputIndex", () => {
  it("returns -1 when there is no user message", () => {
    const messages: StoredMessage[] = [{ role: "assistant", content: "hi" }];
    assert.equal(findCurrentUserInputIndex(messages), -1);
  });

  it("finds the LAST user message, even with assistant/tool messages after it", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "second (current)" },
      { role: "assistant", content: "working on it" },
      { role: "tool", tool_call_id: "1", name: "f", content: "{}" },
    ];
    assert.equal(findCurrentUserInputIndex(messages), 2);
  });
});

describe("extractMessageText", () => {
  it("returns a plain string unchanged", () => {
    assert.equal(extractMessageText("hello"), "hello");
  });

  it("joins text parts from a multimodal content array", () => {
    const content = [{ type: "text", text: "a" }, { type: "image_url" }, { type: "text", text: "b" }];
    assert.equal(extractMessageText(content), "a b");
  });

  it("returns empty string for null content", () => {
    assert.equal(extractMessageText(null), "");
  });
});
