# Main Agent Prompt Management (`gptloop/src/agents/mainagentprompt`)

The `mainagentprompt` directory contains the `MainAgentPromptManager`, which enables creating, editing, selecting, and persisting custom system prompt templates for the primary Main Agent.

---

## 🎯 Purpose & Features

The Main Agent System Prompt dictates the core behavior, formatting rules, tool usage guidelines, and personality of GPTLoop's primary agent.

### Features:
- **Custom System Prompt Variations:** Save multiple named system prompt configurations (e.g. "Strict Concise Coder", "Verbose Tutor", "Security Auditor").
- **Active Prompt Selection:** Switch the active system prompt dynamically via the UI without restarting the server.
- **SQLite Persistence:** Custom prompt configurations and active selection state are persisted in the `app_state` repository.
- **Zero Source-Code Modifications:** Allows users to fine-tune system prompt rules safely without modifying source files.

---

## 🔄 How It Works

1. **Storage:** Prompts are stored as JSON objects in SQLite under `app_state` keys (`main_agent_prompts`).
2. **Management API:** Exposed via Express router at `/api/main-agent-prompts` (supports `GET`, `POST`, `PUT`, `DELETE`, and `/active`).
3. **Runtime Injection:** When a chat stream request arrives (`/api/chat/stream`), `chat.ts` checks `MainAgentPromptManager.getActive()`. If a custom active prompt exists, it overrides the default system prompt during `AgentRunner` execution.

---

## 🖼️ UI Integration

Managed via the **Main Agent Prompts Panel** in the frontend UI. Users can create new prompt templates, edit existing ones, and set the active prompt with a single click.
