/**
 * The one-time context blocks the agent loops (agent.ts, chat.ts, subagents.ts, ...) prepend to the
 * user's FIRST message of a conversation: the persistent-memory block (src/agents/memory.ts,
 * `firstMessageContext()`) and the knowledge-base notice (src/agents/knowledge.ts,
 * `firstMessageContext()`). Auto context summarization must NEVER feed these into the summarizer
 * (memory is explicitly excluded per spec) and must strip any stale copy out of the current user
 * input before it is reused post-compaction (a fresh memory block is re-attached separately).
 */
const PERSISTENT_MEMORY_BLOCK = /<persistent_memory>[\s\S]*?<\/persistent_memory>\s*/g;
const KNOWLEDGE_BASE_BLOCK = /<knowledge_base>[\s\S]*?<\/knowledge_base>\s*/g;

/** Remove any embedded `<persistent_memory>`/`<knowledge_base>` block from a message's text. */
export function stripInjectedContextBlocks(text: string): string {
  return text.replace(PERSISTENT_MEMORY_BLOCK, "").replace(KNOWLEDGE_BASE_BLOCK, "").trimStart();
}
