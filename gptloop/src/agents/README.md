# GPTLoop Agent System (`gptloop/src/agents`)

The `agents` directory is the core intelligence center of GPTLoop. It houses the ReAct execution engine (`agent.ts`), system prompt construction (`systemprompt.ts`), tool registry, specialized sub-agents, dynamic skills, LLM providers, multi-agent teams, CEO orchestration, memory agent service, custom agents, and system prompt management.

---

## 🎯 Architecture Overview

GPTLoop's agent system is built around modular, tool-capable agent runtimes:

```
gptloop/src/agents/
├── agent.ts                  # Core single-agent ReAct runner (AgentRunner)
├── systemprompt.ts           # Dynamic system prompt generator for Main Agent
├── knowledge.ts              # System prompt builder for explicit knowledge entries
├── memory.ts                 # System prompt builder for short/long-term memories
├── todos.ts                  # System prompt builder for active workspace task todos
├── subagents.ts              # Sub-agent execution runner & prompt templates
├── subAgentSessionStore.ts   # Sub-agent session state manager
├── tools/                    # Tool definitions and registry (40+ tools)
├── sub-agents/               # Specialized prompt templates (.md)
├── skills/                   # Modular SKILL.md definitions & initialization
├── providers/                # LLM provider registry & reasoning parser
├── multiagent/               # Multi-agent team runtime (Head + Members)
│   └── ceo/                  # CEO orchestrator runtime
├── memoryagent/              # Asynchronous background memory agent service
├── mainagentprompt/          # Main Agent custom prompt manager
└── customagent/              # User-defined custom top-level agents manager
```

---

## 🧩 Key Components

### 1. Main Agent Runner (`agent.ts`)
The `AgentRunner` drives the primary ReAct (Reasoning + Acting) execution loop:
- Iterates up to `maxIterations` (default: 1000).
- Calls LLM providers registered in `providers/`.
- Executes selected tools (file operations, shell commands, web search, scraping, sub-agents, memory).
- Handles interactive pauses for plan submission (`submit_plan`) and user questions (`ask_question_to_user`).
- Streams real-time thoughts and tool execution events over Server-Sent Events (SSE).

### 2. Tools (`tools/`)
Contains tool schemas and handlers available to agents:
- **File System:** `file_read`, `file_write`, `str_replace`, `apply_patch`, `apply_multiple_edits`, `file_list`, `attach_files`.
- **Shell & Processes:** `shell`, `shell_view`, `bash_write_to_process`.
- **Web & Search:** `web_search`, `fatch_web_urls`, `image_search`, `embed_url`.
- **Sub-Agents:** `call_sub_agent`, `call_multiple_sub_agents`, `build_sub_agent`, `reuse_same_sub_agent_session`, `list_sub_agents`, `list_sub_agent_sessions`, `delete_sub_agent`.
- **Skills:** `list_skills`, `skill_initialize`, `createskill`, `delete_skill`.
- **Memory & Knowledge:** `memory_write`, `memory_read`, `memory_list`, `memory_search`, `memory_edit`, `memory_delete`, `knowledge_create`, `knowledge_read`, `knowledge_list`, `knowledge_search`, `knowledge_edit`, `knowledge_delete`.
- **Todos & Human-in-the-Loop:** `read_todos`, `todo_write`, `submit_plan`, `ask_question_to_user`, `wait`.
- **Multi-Agent & CEO Tools:** `assign_tasks_to_teams`, `send_message_to_team`, `message_team_leader`, `list_teams`, `list_agent_team_members`, `get_team_members_status`, `report_task_completion_to_ceo`.

### 3. Sub-Agents (`sub-agents/`)
Specialized agent personas loaded from `.md` markdown templates (e.g., `CodeExpert`, `SecurityExpert`, `DebugAgent`). Main agents delegate focused sub-tasks to sub-agents via isolated sessions.

### 4. Skills (`skills/`)
Modular capability packages with `SKILL.md` prompt instructions that agents can initialize or create dynamically to extend their domain knowledge.

### 5. LLM Providers (`providers/`)
Unified adapter framework supporting 30+ LLM providers and models. Includes reasoning extraction for models outputting `think` blocks.

### 6. Multi-Agent & CEO Teams (`multiagent/`)
Enables multi-agent collaboration where a **Team Leader** manages **Team Members**, or a top-level **CEO Agent** manages multiple team leaders.

### 7. Background Memory Agent (`memoryagent/`)
An asynchronous background service that runs after completed tasks to analyze conversation logs, extract reusable insights, and persist them into SQLite.

### 8. Custom Agents & System Prompts (`customagent/` & `mainagentprompt/`)
Provides full user control over agent personas and toolsets without code modifications.

---

## 🔗 Related Documentation

- [Sub-Agents System](./sub-agents/README.md)
- [Skills Architecture](./skills/README.md)
- [LLM Provider Registry](./providers/README.md)
- [Multi-Agent Teams](./multiagent/README.md)
- [CEO Orchestration](./multiagent/ceo/README.md)
- [Memory Agent Service](./memoryagent/README.md)
- [Main Agent System Prompts](./mainagentprompt/README.md)
- [Custom Agents](./customagent/README.md)
