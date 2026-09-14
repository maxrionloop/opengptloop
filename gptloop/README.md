# GPTLoop Backend Core (`gptloop`)

The `gptloop` directory contains the core Node.js (TypeScript + Express 5) backend application that powers GPTLoop AI. It executes autonomous agent loops, manages sandboxed workspace tool invocations, streams real-time execution events, and handles persistent state via SQLite.

---

## 🎯 Purpose & Responsibilities

The backend is responsible for:

1. **ReAct Agent Loop Execution:** Hosting the core ReAct (`AgentRunner`) engine that processes user messages, generates thought chains, invokes registered tools, and streams response events.
2. **Tool Sandboxing:** Executing file system operations (`file_read`, `file_write`, `apply_patch`, `apply_multiple_edits`, `str_replace`) strictly contained within the designated `WORKSPACE_ROOT`.
3. **Interactive Shell Management:** Managing background and foreground terminal sessions with command timeouts and real-time process stdout/stdin interaction.
4. **Multi-Agent & CEO Orchestration:** Running multi-agent team workflows (`MultiAgentRunner`) and top-level hierarchical CEO orchestration (`CeoAgentRunner`).
5. **Background Memory Agent:** Running an asynchronous background service (`MemoryAgentService`) after task completion to summarize chat logs and build persistent project knowledge.
6. **SQLite State Persistence:** Managing local SQLite storage via `better-sqlite3` for sessions, messages, snapshots, event history, custom agents, main agent prompts, and background memory runs.
7. **REST & Streaming API:** Exposing Express 5 HTTP endpoints and a Server-Sent Events (SSE) streaming channel (`/api/chat/stream`).

---

## 🏗️ Core Architecture

```
gptloop/src/
├── index.ts                  # Server initialization & route mapping
├── config.ts                 # Environment variable parsing & runtime config
├── agents/                   # ReAct engine, sub-agents, skills, providers, teams, CEO
│   ├── sub-agents/           # Specialized prompt persona templates
│   ├── skills/               # SKILL.md definitions & initialization
│   ├── providers/            # LLM API provider registry & reasoning parser
│   ├── multiagent/           # Team runner & CEO orchestrator
│   ├── memoryagent/          # Asynchronous memory agent service
│   ├── mainagentprompt/      # Custom system prompt manager for Main Agent
│   └── customagent/          # User-defined top-level custom agent manager
├── api/                      # Express route handlers (chat, files, workspace, state, etc.)
├── database/                 # SQLite database connection, schema, queue, repositories
├── scraper/                  # Built-in HTML scraper, fetcher, crawler & parsers
├── services/                 # Session store, question store, plan approval store, event buffer
└── utils/                    # Path sandboxing, SSE helpers, MIME types, vision model detector
```

---

## ⚙️ Configuration & Environment Variables

Configuration is loaded from environment variables (or `.env` file in `gptloop/`).

| Environment Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | HTTP port the Express server listens on | `8787` |
| `WORKSPACE_ROOT` | Sandboxed root directory for all file & shell operations | Current working directory (`process.cwd()`) |
| `MAX_ITERATIONS` | Upper limit of ReAct tool iterations per turn | `1000` |
| `SHELL_TIMEOUT_MS` | Timeout for shell commands in milliseconds | `180000` (3 minutes) |
| `PLAN_APPROVAL_TIMEOUT_MS` | Time waiting for plan approval before auto-proceeding | `60000` (1 minute) |
| `QUESTION_TIMEOUT_MS` | Time waiting for user answers before auto-proceeding | `180000` (3 minutes) |
| `SEARCH_PROVIDER` | Web search engine (`duckduckgo`, `tavily`, `exa`, `serpapi`) | `duckduckgo` |
| `FETCH_PROVIDER` | Web scraping service (`builtin`, `firecrawl`) | `builtin` |
| `MEMORY_AGENT_ENABLED` | Toggles background memory agent processing | `true` |
| `MEMORY_AGENT_INTERVAL` | Number of completed turns between memory runs | `3` |
| `VISION_MODEL_PATTERNS` | Model ID substrings explicitly marked vision-capable | `""` |
| `TEXT_ONLY_MODEL_PATTERNS` | Model ID substrings explicitly marked text-only | `""` |

---

## 🛠️ Key Commands

Run these commands inside the `gptloop` directory:

```bash
# Install backend dependencies
npm install

# Start backend in development mode with auto-reload (tsx watch)
npm run dev

# Start backend in production mode
npm run start

# Compile TypeScript to JavaScript
npm run build

# Run TypeScript type checker without emitting code
npm run typecheck

# Run backend unit tests (Node test runner)
npm test
```

---

## 🔗 Subsystem Links

Explore detailed documentation for each backend component:

- [Agent Ecosystem Documentation](./src/agents/README.md)
  - [Sub-Agents System](./src/agents/sub-agents/README.md)
  - [Skills Architecture](./src/agents/skills/README.md)
  - [LLM Provider Registry](./src/agents/providers/README.md)
  - [Multi-Agent Teams](./src/agents/multiagent/README.md)
  - [CEO Orchestrator](./src/agents/multiagent/ceo/README.md)
  - [Memory Agent Service](./src/agents/memoryagent/README.md)
  - [Main Agent Prompts](./src/agents/mainagentprompt/README.md)
  - [Custom Agents](./src/agents/customagent/README.md)
- [API Endpoints Documentation](./src/api/README.md)
- [Database Subsystem](./src/database/README.md)
- [Web Scraper & Crawler](./src/scraper/README.md)
- [Application Services](./src/services/README.md)
- [Utility Modules](./src/utils/README.md)
