import type { StoredMessage } from "../services/sessionStore.js";

/**
 * Find the "current user input" for context-management purposes: the LAST user-role message in the
 * conversation. This holds reliably for every agent loop in this codebase (agent.ts, chat.ts,
 * subagents.ts, multiagent/agentLoop.ts): exactly one user message is pushed at the start of a turn
 * and no further user message is appended until the next turn, so it remains the last user-role
 * entry for the entire duration of the current turn's Thought -> Action -> Observation loop — even
 * after assistant/tool messages are appended by tool calls made THIS turn.
 *
 * Returns -1 when there is no user message at all (should not happen once a turn has started).
 */
export function findCurrentUserInputIndex(messages: readonly StoredMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return i;
  }
  return -1;
}

/** Extract plain text from a StoredMessage's content (string, multimodal parts array, or null). */
export function extractMessageText(content: StoredMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}
