<div align="center">

<h1>🔄 GPTLoop AI</h1>
<p><strong>A Fast, Autonomous, Local Multi-Agent AI Coding System</strong></p>

<p>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.9.0-brightgreen.svg" alt="Node.js Version" />
  <img src="https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-5.x-lightgrey.svg" alt="Express 5" />
  <img src="https://img.shields.io/badge/React-19.x-61dafb.svg" alt="React 19" />
  <img src="https://img.shields.io/badge/Database-SQLite%20(better--sqlite3)-orange.svg" alt="SQLite" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

<p>
GPTLoop is an end-to-end, local-first AI software engineering system that pairs an autonomous execution agent with persistent SQLite memory, specialized sub-agents, multi-agent team hierarchies, skills materialization, web search/scraping, and a real-time streaming web console.
</p>

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features & Capabilities](#-key-features--capabilities)
- [System Architecture](#-system-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Repository Structure](#-repository-structure)
- [Core Workflows](#-core-workflows)
- [API & Integration Summary](#-api--integration-summary)
- [Troubleshooting](#-troubleshooting)
- [Documentation Index](#-documentation-index)

---

## 🌟 Overview

GPTLoop solves complex software engineering tasks autonomously. Rather than acting as a simple text wrapper around an LLM, GPTLoop combines:

1. **Autonomous ReAct Agent Engine:** Sandboxed file operations (`file_read`, `file_write`, `str_replace`, `apply_patch`, `apply_multiple_edits`), interactive shell execution (`shell`, `bash_write_to_process`, `shell_view`), image/QR code scanning, and task planning.
2. **Persistent Knowledge & Background Memory:** SQLite-backed memory store with a background `MemoryAgentService` that extracts insights, context, and structural facts after user tasks complete.
3. **Multi-Agent Orchestration:** Flexible single-agent execution, hierarchical agent teams (team leader + member specialists), and a top-level **CEO Agent** that plans and delegates tasks across multiple teams.
4. **Specialized Sub-Agents & Custom Agents:** Pre-packaged specialized prompt personas (e.g. `CodeExpert`, `SecurityExpert`, `DebugAgent`) plus user-configurable custom top-level agents.
5. **Dynamic Skill Materialization:** Modular SKILL.md definitions that can be initialized, dynamically created, or invoked on demand.
6. **Web Search & Content Scraping:** Built-in free web search (DuckDuckGo) and HTML scraper/crawler with optional Tavily, Exa, SerpAPI, and Firecrawl integrations.
7. **Streaming Frontend UI ("Haku"):** A modern React 19 / Vite workspace interface offering real-time SSE event streaming, file preview panels, memory agent session view, todo tracking, plan approval, interactive user question blocks, and multi-agent monitoring.

---

## 🔥 Key Features & Capabilities

<table>
  <thead>
    <tr>
      <th>Category</th>
      <th>Capabilities & Features</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Agent Execution</strong></td>
      <td>
        • Autonomous ReAct loop with configurable iteration caps.<br/>
        • Sandboxed workspace file manipulations with diff & patch support.<br/>
        • Long-running background shell commands and process management.<br/>
        • Structured plan submission with human-in-the-loop approval timeouts.<br/>
        • Interactive question/answer store for user clarifications.
      </td>
    </tr>
    <tr>
      <td><strong>Multi-Agent & CEO</strong></td>
      <td>
        • <strong>Team Mode:</strong> Team leader coordinates specialized worker agents.<br/>
        • <strong>CEO Mode:</strong> Strategic CEO agent orchestrates multiple team leaders.<br/>
        • Real-time inter-agent messaging and status tracking via SSE.
      </td>
    </tr>
    <tr>
      <td><strong>Memory & Knowledge</strong></td>
      <td>
        • Local SQLite persistence using <code>better-sqlite3</code> in WAL mode.<br/>
        • Background Memory Agent automatically summarizes turns and builds long-term facts.<br/>
        • Explicit knowledge base creation, edit, deletion, and vector-less text search.
      </td>
    </tr>
    <tr>
      <td><strong>Web & Scraping</strong></td>
      <td>
        • Built-in HTML scraper & Markdown parser (keyless & free).<br/>
        • Multi-page web crawling with link extraction and deduplication.<br/>
        • DuckDuckGo search integration out of the box, with Tavily/Exa/SerpAPI/Firecrawl support.
      </td>
    </tr>
    <tr>
      <td><strong>LLM Providers</strong></td>
      <td>
        • Native support for 30+ providers (OpenAI, Anthropic, OpenRouter, Ollama Cloud, Groq, DeepSeek, Cerebras, Fireworks, Cohere, HuggingFace, Mistral, NVIDIA, etc.).<br/>
        • Advanced reasoning parser handling <code>&lt;think&gt;</code> blocks.<br/>
        • Automatic vision model detection and fallback overrides.
      </td>
    </tr>
    <tr>
      <td><strong>Frontend UI</strong></td>
      <td>
        • Streaming SSE chat log with live thought process & tool call inspection.<br/>
        • Panels for Skills, Memory, Custom Agents, Main Agent Prompts, Teams, and CEO.<br/>
        • Workspace file viewer, Todo manager, and live process monitor.
      </td>
    </tr>
  </tbody>
</table>

---

## 🏗️ System Architecture

GPTLoop separates backend execution logic from the user interface while sharing local state persistence:

```
                  ┌─────────────────────────────────────────┐
                  │          Frontend UI ("Haku")           │
                  │   Vite + React 19 + Tailwind v4      │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / SSE (/api/*)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │            Backend Service              │
                  │        Express 5 + TypeScript           │
                  │           (Port 8787)                   │
                  └───────┬────────────┬─────────────┬──────┘
                          │            │             │
        ┌─────────────────▼┐   ┌───────▼─────────┐  ┌▼──────────────────┐
        │  Agent Engine    │   │ Memory Agent    │  │ Web Scraper       │
        │  • Main Agent    │   │ • Context Ext.  │  │ • HTML Parser     │
        │  • Sub-Agents    │   │ • Knowledge     │  │ • Link Crawler    │
        │  • Teams & CEO   │   │ • Event Buffer  │  │ • Markdown Text   │
        └────────┬─────────┘   └───────┬─────────┘  └───────────────────┘
                 │                     │
                 └──────────┬──────────┘
                            ▼
           ┌──────────────────────────────────┐
           │        SQLite Persistence        │
           │  <workspace>/.gptloop/gptloop.db │
           └──────────────────────────────────┘
```

---

## ⚡ Prerequisites

- **Node.js**: `v20.9.0` or higher
- **npm**: `v10.0.0` or higher
- **Operating System**: macOS, Linux, or Windows (WSL recommended)

---

## 🚀 Quick Start

### 1. Fast Launch Script

The repository includes a convenience script that installs dependencies and launches both the backend and frontend servers:

```bash
./start.sh
```

To stop both services:

```bash
./stop.sh
```

### 2. Manual Setup

If you prefer running services independently:

#### Backend Setup (`/gptloop`)
```bash
cd gptloop
npm install
npm run dev
```
The backend server starts on **http://localhost:8787**. Health check is available at `http://localhost:8787/health`.

#### Frontend Setup (`/frontend-main`)
```bash
cd frontend-main
npm install
npm run dev
```
The web console starts on **http://localhost:5173** and proxies `/api` requests to the backend.

---

## ⚙️ Configuration

GPTLoop uses environment variables for configuration. Copy `.env.example` in `gptloop/` to `.env` to customize settings:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP port for backend server | `8787` |
| `WORKSPACE_ROOT` | Sandboxed target directory for file & shell execution | Directory where server was started |
| `MAX_ITERATIONS` | Maximum ReAct loops allowed per chat turn | `1000` |
| `SHELL_TIMEOUT_MS` | Timeout for shell tool commands (ms) | `180000` (3 mins) |
| `PLAN_APPROVAL_TIMEOUT_MS` | Duration wait for plan approval before auto-proceeding | `60000` (1 min) |
| `QUESTION_TIMEOUT_MS` | Duration wait for user answers before auto-proceeding | `180000` (3 mins) |
| `SEARCH_PROVIDER` | Web search engine (`duckduckgo`, `tavily`, `exa`, `serpapi`) | `duckduckgo` |
| `FETCH_PROVIDER` | Scraper service (`builtin`, `firecrawl`) | `builtin` |
| `MEMORY_AGENT_ENABLED` | Toggle background memory extraction engine | `true` |
| `MEMORY_AGENT_INTERVAL` | Number of completed tasks triggering memory builds | `3` |

---

## 📁 Repository Structure

```
.
├── start.sh                      # Unified launch script
├── stop.sh                       # Unified shutdown script
├── Dockerfile                    # Containerization build instructions
├── Dockerfile.base                # Base docker layer
├── gptloop/                      # Backend core application
│   ├── package.json              # Backend dependencies & test scripts
│   └── src/
│       ├── index.ts              # Server bootstrapper & Express route bindings
│       ├── config.ts             # Environment configuration parser
│       ├── agents/               # ReAct agents, sub-agents, skills, providers, teams, CEO
│       ├── api/                  # Express HTTP routers & SSE handlers
│       ├── database/             # SQLite connection, schema, repositories & write queue
│       ├── scraper/              # HTML parser, fetcher, crawler & extraction modules
│       ├── services/             # Application state, session, and event stores
│       └── utils/                # Path sandboxing, SSE helpers, MIME & vision utilities
└── frontend-main/                # Web application console ("Haku")
    ├── package.json              # Frontend dependencies
    ├── vite.config.ts            # Vite config with API proxy
    └── src/                      # React UI components, Zustand stores, and panels
```

---

## 🔄 Core Workflows

1. **User Request Submission:** The user submits a prompt or task in the web console.
2. **Execution Strategy Selection:**
   - **Main Agent:** Standard single-agent ReAct loop executing tools autonomously.
   - **Team Mode:** Team Leader decomposes request into sub-tasks assigned to worker agents.
   - **CEO Mode:** CEO Agent orchestrates multi-team task execution.
3. **Plan Approval & Clarifications:** If `submit_plan` or `ask_question_to_user` is invoked, execution pauses waiting for user input or until timeout elapsed.
4. **Tool Execution:** Backend sandboxes file system actions inside `WORKSPACE_ROOT` and executes shell commands securely.
5. **Background Memory Update:** Upon turn completion, `MemoryAgentService` extracts learnings into SQLite without blocking the user interface.

---

## 🔌 API & Integration Summary

The backend exposes a clean REST & SSE API interface:

- `GET /health` - System health, SQLite status, loaded providers and tools.
- `POST /api/chat/stream` - SSE streaming endpoint for chat completion and tool execution.
- `GET /api/providers` - Available model providers and configured keys.
- `GET /api/tools` - Registered agent tools and JSON schemas.
- `GET /api/workspace` & `POST /api/workspace` - Workspace directory inspection and switching.
- `GET /api/memory-agent/runs` - History and status of background memory runs.

---

## ❓ Troubleshooting

#### 1. Port `8787` or `5173` is already in use
Run `./stop.sh` or kill the bound processes manually:
```bash
fuser -k 8787/tcp
fuser -k 5173/tcp
```

#### 2. Model outputs fail with "vision not supported" on image tools
If your model supports vision but isn't recognized automatically, set `VISION_MODEL_PATTERNS` in `gptloop/.env`:
```env
VISION_MODEL_PATTERNS=claude-3-5,gpt-4o,llava
```

#### 3. Database is locked or file permission error
GPTLoop uses SQLite WAL mode with a single async write queue. Ensure your `WORKSPACE_ROOT` directory has read/write permissions for the user running Node.js.

---

## 📚 Documentation Index

For detailed documentation on specific subsystems, consult the following README files:

- [Backend Engine README](./gptloop/README.md)
- [Frontend Console README](./frontend-main/README.md)
- [Agent System README](./gptloop/src/agents/README.md)
  - [Sub-Agents Documentation](./gptloop/src/agents/sub-agents/README.md)
  - [Skills System Documentation](./gptloop/src/agents/skills/README.md)
  - [LLM Providers Documentation](./gptloop/src/agents/providers/README.md)
  - [Multi-Agent System Documentation](./gptloop/src/agents/multiagent/README.md)
  - [CEO Orchestration Documentation](./gptloop/src/agents/multiagent/ceo/README.md)
  - [Memory Agent Documentation](./gptloop/src/agents/memoryagent/README.md)
  - [Main Agent Prompts Documentation](./gptloop/src/agents/mainagentprompt/README.md)
  - [Custom Agent Documentation](./gptloop/src/agents/customagent/README.md)
- [Database Subsystem README](./gptloop/src/database/README.md)
- [API Layer README](./gptloop/src/api/README.md)
- [Web Scraper README](./gptloop/src/scraper/README.md)
- [Application Services README](./gptloop/src/services/README.md)
- [Utilities README](./gptloop/src/utils/README.md)

---

<div align="center">
  <p>GPTLoop AI • Sandboxed, Autonomous, Multi-Agent Software Engineering</p>
</div>
