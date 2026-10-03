import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeContextManagementSettings,
  DEFAULT_SLIDING_WINDOW_TRUNCATE_TOKENS,
  MIN_SLIDING_WINDOW_TRUNCATE_TOKENS,
  MAX_SLIDING_WINDOW_TRUNCATE_TOKENS,
} from "./types.js";

describe("normalizeContextManagementSettings", () => {
  it("defaults to summarize mode and the default truncation amount", () => {
    const settings = normalizeContextManagementSettings({});
    assert.equal(settings.mode, "summarize");
    assert.equal(settings.contextWindow, 0);
    assert.equal(settings.slidingWindowTruncateTokens, DEFAULT_SLIDING_WINDOW_TRUNCATE_TOKENS);
  });

  it("accepts sliding_window mode explicitly", () => {
    const settings = normalizeContextManagementSettings({ mode: "sliding_window" });
    assert.equal(settings.mode, "sliding_window");
  });

  it("rejects an unknown mode string back to the summarize default", () => {
    const settings = normalizeContextManagementSettings({ mode: "bogus" });
    assert.equal(settings.mode, "summarize");
  });

  it("parses a numeric or string context window, clamping negatives/garbage to 0 (no-op)", () => {
    assert.equal(normalizeContextManagementSettings({ contextWindow: 128_000 }).contextWindow, 128_000);
    assert.equal(normalizeContextManagementSettings({ contextWindow: "256000" }).contextWindow, 256_000);
    assert.equal(normalizeContextManagementSettings({ contextWindow: -5 }).contextWindow, 0);
    assert.equal(normalizeContextManagementSettings({ contextWindow: "not a number" }).contextWindow, 0);
  });

  it("clamps the sliding-window truncation amount to the documented bounds", () => {
    assert.equal(
      normalizeContextManagementSettings({ slidingWindowTruncateTokens: 1 }).slidingWindowTruncateTokens,
      MIN_SLIDING_WINDOW_TRUNCATE_TOKENS,
    );
    assert.equal(
      normalizeContextManagementSettings({ slidingWindowTruncateTokens: 10_000_000 })
        .slidingWindowTruncateTokens,
      MAX_SLIDING_WINDOW_TRUNCATE_TOKENS,
    );
    assert.equal(
      normalizeContextManagementSettings({ slidingWindowTruncateTokens: 7000 }).slidingWindowTruncateTokens,
      7000,
    );
  });
});
