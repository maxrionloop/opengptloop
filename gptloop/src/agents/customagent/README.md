# Custom Top-Level Agents (`gptloop/src/agents/customagent`)

The `customagent` directory implements user-defined custom top-level agents (`CustomAgentManager` and `CustomAgentRunner`). It allows users to create, configure, and execute independent agents with tailored personalities and specific tool permissions.

---

## 🎯 What Are Custom Agents?

Custom Agents are independent top-level agents that users can select and run directly from the UI composer, as an alternative to the built-in Main Agent.

### Custom Agents vs. Sub-Agents

| Feature | Custom Agents | Sub-Agents |
| :--- | :--- | :--- |
| **Execution Context** | Top-level main agent selected directly by user. | Delegated persona invoked *by* a main agent via tools. |
| **Tool Selection** | User explicitly selects allowed tool subsets. | Pre-configured or full tool access based on template. |
| **User Interaction** | User chats directly with the Custom Agent. | Interacts with the Main Agent (which calls the Sub-Agent). |
| **Storage** | Persisted in SQLite `app_state` repository. | Stored as `.md` templates or dynamic sub-agent sessions. |

---

## ⚙️ Configuration Capabilities

When creating or editing a Custom Agent, users can configure:

- **Name & ID:** Unique agent identifier.
- **Description:** Purpose and summary of capabilities.
- **System Prompt:** Full custom instruction set defining behavior and constraints.
- **Tool Selection:** Granular whitelist of allowed tools (e.g. restrict to read-only tools or specific file tools).

---

## 🔄 Runtime Execution

1. **Manager:** `CustomAgentManager` handles CRUD operations and persistence in SQLite.
2. **API Router:** Exposed at `/api/custom-agents`.
3. **Runner:** `CustomAgentRunner` executes the custom agent using the core `AgentRunner` engine, applying the agent's custom system prompt and restricted tool subset.
