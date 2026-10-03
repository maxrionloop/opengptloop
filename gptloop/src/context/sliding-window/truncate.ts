import type { StoredMessage } from "../../services/sessionStore.js";
import { estimateMessagesTokens, estimateMessageTokens, estimateTextTokens } from "../estimator.js";

/**
 * Sliding-window context management: when the live context nears the model's limit, delete the
 * OLDEST eligible tokens so the agent can keep working forever without ever hard-stopping on a
 * context-length error — instead of summarizing, it simply forgets the oldest non-essential detail.
 *
 * Eligibility (per spec):
 *  - NEVER deleted: the system prompt (not part of this array), every user message (past AND
 *    current user input — protecting user messages also automatically protects any persistent
 *    memory block embedded in the first user message, since that message is never touched).
 *  - Eligible for deletion: assistant/tool "chat data", reasoning tokens, and tool calls (including
 *    their results).
 *
 * Deletion always proceeds OLDEST-FIRST and stops as soon as the requested token budget has been
 * freed, so the most recent content is always the last to be touched.
 *
 * Two passes, cheapest-first:
 *  1. Strip `reasoning_content` from the oldest assistant messages (a message held back for
 *     provider replay — see agent.ts comment — but not something the user ever needs to see again).
 *  2. If still short of budget, delete whole oldest "turns": either a standalone final-answer
 *     assistant message, or an assistant-with-tool_calls message TOGETHER WITH every tool-result
 *     message that answers it (they must never be split — an orphaned `tool_call_id` on either side
 *     produces an invalid request to every OpenAI-compatible provider).
 */
export interface SlidingWindowOutcome {
  messages: StoredMessage[];
  beforeTokensEstimate: number;
  afterTokensEstimate: number;
  removedTokensEstimate: number;
  removedMessageCount: number;
  strippedReasoningCount: number;
}

export function applySlidingWindowTruncation(
  messages: readonly StoredMessage[],
  targetTokensToRemove: number,
): SlidingWindowOutcome {
  const beforeTokensEstimate = estimateMessagesTokens(messages);
  const target = Math.max(0, Math.floor(targetTokensToRemove));

  // Work on shallow copies so the originals (which may still be referenced elsewhere, e.g. a
  // just-persisted snapshot) are never mutated in place.
  let working: StoredMessage[] = messages.map((m) => ({ ...m }));

  let removed = 0;
  let strippedReasoningCount = 0;

  // Pass 1 — strip reasoning_content from the oldest assistant messages first.
  for (let i = 0; i < working.length && removed < target; i++) {
    const message = working[i]!;
    if (message.role === "user") continue; // protected
    if (message.role !== "assistant" || !message.reasoning_content) continue;
    removed += estimateTextTokens(message.reasoning_content);
    strippedReasoningCount += 1;
    const { reasoning_content: _drop, ...rest } = message;
    working[i] = rest;
  }

  // Pass 2 — delete whole oldest deletable groups until the budget is met.
  let removedMessageCount = 0;
  let i = 0;
  while (i < working.length && removed < target) {
    const message = working[i]!;
    if (message.role === "user") {
      i += 1; // protected — never deleted, never merged across
      continue;
    }

    const group = collectDeletableGroup(working, i);
    const groupTokens = group.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    working.splice(i, group.length);
    removed += groupTokens;
    removedMessageCount += group.length;
    // Do not advance `i` — the array shrank, so index `i` now holds the next message.
  }

  const afterTokensEstimate = estimateMessagesTokens(working);
  return {
    messages: working,
    beforeTokensEstimate,
    afterTokensEstimate,
    removedTokensEstimate: Math.max(0, beforeTokensEstimate - afterTokensEstimate),
    removedMessageCount,
    strippedReasoningCount,
  };
}

/**
 * Starting at `index` (guaranteed non-"user"), collect the smallest set of messages that can be
 * deleted together without orphaning a tool_call_id: either one standalone message, or an
 * assistant-with-tool_calls message plus every immediately-following tool message that answers one
 * of its tool_calls.
 */
function collectDeletableGroup(messages: readonly StoredMessage[], index: number): StoredMessage[] {
  const head = messages[index]!;
  if (head.role !== "assistant" || !head.tool_calls || head.tool_calls.length === 0) {
    return [head];
  }
  const ids = new Set<string>();
  for (const call of head.tool_calls) {
    const id = (call as { id?: unknown }).id;
    if (typeof id === "string") ids.add(id);
  }
  const group: StoredMessage[] = [head];
  let j = index + 1;
  while (j < messages.length) {
    const candidate = messages[j]!;
    if (candidate.role !== "tool") break;
    if (candidate.tool_call_id && !ids.has(candidate.tool_call_id)) break;
    group.push(candidate);
    j += 1;
  }
  return group;
}
