import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSummarizableExtract } from "./extract.js";
import type { StoredMessage } from "../../services/sessionStore.js";

describe("buildSummarizableExtract", () => {
  it("excludes the current user input (by index) but includes past user inputs", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "past input" },
      { role: "assistant", content: "an answer" },
      { role: "user", content: "CURRENT INPUT" },
    ];
    const extract = buildSummarizableExtract(messages, 2);
    assert.ok(extract.text.includes("past input"));
    assert.ok(!extract.text.includes("CURRENT INPUT"));
  });

  it("excludes reasoning_content entirely (never reads the field)", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "answer", reasoning_content: "SECRET_REASONING_TOKENS" },
      { role: "user", content: "current" },
    ];
    const extract = buildSummarizableExtract(messages, 2);
    assert.ok(!extract.text.includes("SECRET_REASONING_TOKENS"));
  });

  it("strips persistent_memory and knowledge_base blocks from message text", () => {
    const messages: StoredMessage[] = [
      {
        role: "user",
        content: "<persistent_memory>SECRET MEMORY</persistent_memory>actual question",
      },
      { role: "user", content: "current" },
    ];
    const extract = buildSummarizableExtract(messages, 1);
    assert.ok(!extract.text.includes("SECRET MEMORY"));
    assert.ok(extract.text.includes("actual question"));
  });

  it("includes tool calls and their results", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "do something" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "1", type: "function", function: { name: "read_file", arguments: '{"path":"a.ts"}' } }],
      },
      { role: "tool", tool_call_id: "1", name: "read_file", content: "file contents here" },
      { role: "user", content: "current" },
    ];
    const extract = buildSummarizableExtract(messages, 3);
    assert.ok(extract.text.includes("read_file"));
    assert.ok(extract.text.includes("file contents here"));
    assert.equal(extract.messageCount, 3);
  });

  it("returns an empty extract when there is nothing but the current input", () => {
    const messages: StoredMessage[] = [{ role: "user", content: "current only" }];
    const extract = buildSummarizableExtract(messages, 0);
    assert.equal(extract.text, "");
    assert.equal(extract.messageCount, 0);
  });
});
