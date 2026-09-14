# Database Subsystem (`gptloop/src/database`)

The `database` directory manages local persistent state for GPTLoop using SQLite via `better-sqlite3`. It provides transactional schema creation, asynchronous write queuing, and repository abstractions.

---

## 🎯 Purpose & Responsibilities

The database subsystem maintains all long-term and short-term application state locally within the user's workspace:

1. **Auto-Created Database File:** Automatically creates and opens `<workspace>/.gptloop/gptloop.db` on backend boot.
2. **Write Queue (`writeQueue.ts`):** Serializes database write operations onto an asynchronous queue to prevent SQLite table locks (`SQLITE_BUSY`) in WAL mode.
3. **Repository Abstraction (`repositories/`):** Clean typed access to stored domain models.
4. **WAL Mode Maintenance (`maintenance.ts`):** Enforces Write-Ahead Logging (WAL) and performs safe checkpoints and clean shutdowns on server SIGINT/SIGTERM.

---

## 📊 Database Repositories & Stored Data

The schema (`schema.ts`) manages the following data areas:

| Repository | Table / Domain | Data Stored |
| :--- | :--- | :--- |
| `sessionsRepo` | `sessions` | Chat session metadata, active status, creation and update timestamps. |
| `messagesRepo` | `messages` | Chat conversation messages, role (`user`/`assistant`), content, and tool calls. |
| `eventsRepo` | `events` | SSE event stream log per turn (thoughts, tool execution, process outputs). |
| `snapshotsRepo` | `snapshots` | Complete workspace and session state snapshots for session recovery. |
| `subAgentRunsRepo` | `sub_agent_runs` | Isolated sub-agent session logs, prompt parameters, and result strings. |
| `memoryAgentRunsRepo` | `memory_agent_runs` | History, execution status, and task counts of background memory agent runs. |
| `appStateRepo` | `app_state` | App settings, custom agents, main agent system prompts, teams, CEO setup, short/long-term memories, and knowledge base items. |

---

## ⚙️ Operational Behavior

- **Database Location:** Located at `<workspace>/.gptloop/gptloop.db` relative to the active `WORKSPACE_ROOT`.
- **Zero External Dependencies:** Runs completely locally without requiring separate database server installation or setup.
- **Privacy & Security:** All conversation history, custom agent prompts, and knowledge items remain stored entirely on the local file system.

> 🔒 **Security Note:** Private API keys passed dynamically per-request are processed in memory and never logged or stored in the database.
