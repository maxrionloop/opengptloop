# Backend API Layer (`gptloop/src/api`)

The `api` directory defines the Express 5 REST and Server-Sent Events (SSE) routers exposed by the GPTLoop backend server listening on port 8787.

---

## 🎯 Route Overview

All API endpoints are mounted under `/api` (plus `/health` on the server root).

| Router File | Endpoint Base | Functionality & Capabilities |
| :--- | :--- | :--- |
| `chat.ts` | `/api/chat` | Main SSE streaming endpoint (`/stream`), plan approval decisions, user question answers, session management, and turn cancellation (`/stop`). |
| `providers.ts` | `/api/providers` | Lists registered LLM providers, model IDs, and capability metadata. |
| `tools.ts` | `/api/tools` | Exposes registered agent tool schemas and JSON schema definitions. |
| `systemprompt.ts` | `/api/system-prompt` | Retrieves the default system prompt text for the Main Agent. |
| `customagents.ts` | `/api/custom-agents` | Full CRUD operations for user-defined top-level custom agents. |
| `mainagentprompts.ts` | `/api/main-agent-prompts` | CRUD operations and active selection toggle for Main Agent prompt templates. |
| `files.ts` | `/api/files` | Workspace file tree traversal, file reading, file writing, image reading, and file uploads. |
| `workspace.ts` | `/api/workspace` | Inspects current workspace root directory path and handles runtime workspace switching. |
| `scrape.ts` | `/api/scrape` | Triggers web scraping or multi-page site crawling for a target URL. |
| `state.ts` | `/api/state` | Reset application state, export workspace database state, and import state backups. |
| `memoryagent.ts` | `/api/memory-agent` | Retrieves background memory run logs and manually triggers background memory builds (`/trigger`). |

---

## 📡 SSE Chat Streaming (`/api/chat/stream`)

The primary interaction endpoint is `POST /api/chat/stream`. It accepts a JSON payload specifying:
- `messages`: Conversation turn history.
- `model` / `provider`: Selected LLM model and provider ID.
- `mode`: Execution mode (`agent`, `team`, or `ceo`).
- `apiKey`: Optional per-request API key override.
- `customAgentId`: Optional ID if executing a custom top-level agent.
- `systemPromptOverride`: Optional system prompt override.

The server responds with a `text/event-stream` SSE channel emitting real-time events (`thought`, `tool_call`, `tool_result`, `process_output`, `plan_approval_required`, `ask_question`, `done`, `error`).

---

## 🔒 Security & Sandboxing

- File endpoints (`/api/files`) enforce strict path normalization to ensure file access never escapes `WORKSPACE_ROOT`.
- CORS policy is configured via `CORS_ORIGINS` in `gptloop/.env`.
