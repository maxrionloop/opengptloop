import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { stripInjectedContextBlocks } from "./contextTags.js";

describe("stripInjectedContextBlocks", () => {
  it("removes a persistent_memory block", () => {
    const text = "<persistent_memory>secret stuff</persistent_memory>the real question";
    assert.equal(stripInjectedContextBlocks(text), "the real question");
  });

  it("removes a knowledge_base block", () => {
    const text = "<knowledge_base>files...</knowledge_base>the real question";
    assert.equal(stripInjectedContextBlocks(text), "the real question");
  });

  it("removes both blocks when both are present", () => {
    const text = "<persistent_memory>m</persistent_memory><knowledge_base>k</knowledge_base>question";
    assert.equal(stripInjectedContextBlocks(text), "question");
  });

  it("leaves plain text untouched", () => {
    assert.equal(stripInjectedContextBlocks("just a question"), "just a question");
  });
});
