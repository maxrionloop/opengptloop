# Memory Agent Service (`gptloop/src/agents/memoryagent`)

The `memoryagent` directory implements the background memory extraction engine (`MemoryAgentService` and `MemoryAgentRunner`) for GPTLoop. It continuously analyzes completed chat sessions to extract long-term facts, architectural insights, and project context into local SQLite storage.

---

## 🎯 Purpose & Capabilities

Without persistent memory, AI agents lose context between independent chat sessions. The Memory Agent solves this by running asynchronously in the background to:

1. **Summarize Completed Tasks:** Extract concise summaries of completed user requests.
2. **Identify Codebase Insights:** Record structural facts (e.g. key frameworks, directory roles, build scripts) discovered during agent execution.
3. **Persist Knowledge:** Write structured memory items to the `memory` and `knowledge` SQLite tables.
4. **Inject Historical Context:** Automatically supply relevant memories to future agent turns via the system prompt (`memory.ts` and `knowledge.ts`).

---

## ⚙️ How It Works

```
 User Chat Turn Completed
          │
          ▼
┌───────────────────┐
│ Memory Scheduler  │ ──> Check interval (default: every 3 tasks)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ MemoryAgentRunner │ ──> Runs in background thread (non-blocking)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ SQLite Database   │ ──> Persists to memory & knowledge tables
└───────────────────┘
```

1. **Triggering:**
   - **Automatic:** Runs automatically after every `MEMORY_AGENT_INTERVAL` completed user tasks (default: 3).
   - **Manual:** Can be triggered on demand via the UI (**Memory Agent Panel**) or REST API (`POST /api/memory-agent/trigger`).
2. **Background Execution:** Operates asynchronously in the backend without delaying user chat responses.
3. **Status Tracking:** Execution status and metrics are persisted in the `memory_agent_runs` table and exposed via `GET /api/memory-agent/runs`.

---

## ⚙️ Configuration

Set environment variables in `gptloop/.env`:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `MEMORY_AGENT_ENABLED` | Enable or disable background memory building | `true` |
| `MEMORY_AGENT_INTERVAL` | Number of completed turns between background memory runs | `3` |
