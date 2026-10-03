import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  estimateTextTokens,
  estimateCharsAsTokens,
  estimateContentTokens,
  estimateMessageTokens,
  estimateMessagesTokens,
  estimateRequestTokens,
} from "./estimator.js";

describe("estimateTextTokens", () => {
  it("returns 0 for empty/undefined/null text", () => {
    assert.equal(estimateTextTokens(""), 0);
    assert.equal(estimateTextTokens(undefined), 0);
    assert.equal(estimateTextTokens(null), 0);
  });

  it("estimates ~4 chars per token, rounded up", () => {
    assert.equal(estimateTextTokens("abcd"), 1);
    assert.equal(estimateTextTokens("abcde"), 2);
    assert.equal(estimateTextTokens("a".repeat(400)), 100);
  });
});

describe("estimateCharsAsTokens", () => {
  it("matches estimateTextTokens for an equivalent character count", () => {
    assert.equal(estimateCharsAsTokens(0), 0);
    assert.equal(estimateCharsAsTokens(4), 1);
    assert.equal(estimateCharsAsTokens(5), 2);
    assert.equal(estimateCharsAsTokens(400), 100);
  });
});

describe("estimateContentTokens", () => {
  it("handles plain string content", () => {
    assert.equal(estimateContentTokens("abcd"), 1);
  });

  it("handles null/undefined content", () => {
    assert.equal(estimateContentTokens(null), 0);
    assert.equal(estimateContentTokens(undefined), 0);
  });

  it("sums text parts in a multimodal content array and flat-costs non-text parts", () => {
    const content = [
      { type: "text", text: "abcd" }, // 1 token
      { type: "image_url", image_url: { url: "x" } }, // flat 16
    ];
    assert.equal(estimateContentTokens(content), 1 + 16);
  });
});

describe("estimateMessageTokens", () => {
  it("adds per-message overhead on top of content", () => {
    assert.equal(estimateMessageTokens({ content: "abcd" }), 1 + 4);
  });

  it("includes reasoning_content, tool_calls, and name", () => {
    const tokens = estimateMessageTokens({
      content: null,
      reasoning_content: "abcd", // 1 token
      tool_calls: [{ id: "1", type: "function", function: { name: "f", arguments: "{}" } }],
      name: "f", // 1 token
    });
    // reasoning (1) + tool_calls JSON (>0) + name (1) + overhead (4) must all be counted.
    assert.ok(tokens > 1 + 1 + 4);
  });
});

describe("estimateMessagesTokens / estimateRequestTokens", () => {
  it("sums across every message and adds the system prompt", () => {
    const messages = [{ content: "abcd" }, { content: "abcd" }];
    const perMessage = estimateMessageTokens(messages[0]!);
    assert.equal(estimateMessagesTokens(messages), perMessage * 2);
    assert.equal(
      estimateRequestTokens("abcd", messages),
      estimateTextTokens("abcd") + perMessage * 2,
    );
  });
});
