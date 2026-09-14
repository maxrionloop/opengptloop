# Sub-Agents System (`gptloop/src/agents/sub-agents`)

The `sub-agents` directory contains prompt definitions, loaders, and templates for specialized sub-agents in GPTLoop. Sub-agents are domain-specific agent personas designed to execute delegated tasks in isolated sessions.

---

## 🎯 What Are Sub-Agents?

Sub-agents are specialized prompt personas created to handle specific sub-tasks—such as reviewing code, debugging errors, auditing security, or researching web documentation—without cluttering the main agent's context window.

### Why Use Sub-Agents?
1. **Context Isolation:** Keeps verbose intermediate research or analysis separate from the primary conversation.
2. **Specialized System Prompts:** Enforces strict domain expertise through focused system prompts.
3. **Parallel Execution:** Main agents can invoke multiple sub-agents in parallel (`call_multiple_sub_agents`).
4. **Session Reuse:** Multi-turn sessions with a sub-agent can be continued using `reuse_same_sub_agent_session`.

---

## 📋 Built-In Sub-Agent Personas

The system includes pre-built sub-agent definitions defined as markdown files:

| Sub-Agent Persona | File | Primary Responsibility |
| :--- | :--- | :--- |
| **Code Expert** | `codeexpert.md` | Writes high-quality, production-ready code implementation. |
| **Code Reviewer** | `codereviewer.md` | Audits code changes for bugs, style consistency, and performance issues. |
| **Data Analyst** | `dataanalyst.md` | Analyzes data structures, JSON schema, and database models. |
| **Debug Agent** | `debugagent.md` | Investigates error logs, stack traces, and failing unit tests. |
| **Deep Explorer** | `deepexplorer.md` | Explores repository structure and maps file dependencies. |
| **Documentation Agent** | `documentationagent.md` | Drafts comprehensive project READMEs and inline documentation. |
| **Project Planner** | `projectplanner.md` | Breaks complex features into structured, actionable implementation steps. |
| **Security Expert** | `securityexpert.md` | Scans for vulnerability risks, credential leaks, and permission bugs. |
| **UI/UX Designer** | `uiuxdesigner.md` | Evaluates frontend layout, user experience, and Tailwind CSS styles. |
| **Web Researcher** | `webresearcher.md` | Performs web searches and web page scraping for external technical context. |

---

## 🔄 Execution & Lifecycle

1. **Invocation:** The main agent calls `call_sub_agent` or `call_multiple_sub_agents` with a targeted task description and selected sub-agent name.
2. **Session Creation:** A new sub-agent session is initialized and tracked by `SubAgentSessionStore`.
3. **Execution:** The sub-agent runs inside a sandboxed ReAct sub-loop using allowed tools (file reading, web searching, shell inspection).
4. **Result Return:** The sub-agent's final output is returned to the main agent as a tool result string.
5. **Session Continuation / Deletion:** The main agent can re-query the sub-agent session (`reuse_same_sub_agent_session`) or delete old sub-agent sessions (`delete_sub_agent`).

---

## 🛠️ Dynamic Sub-Agent Creation

In addition to built-in markdown personas, users and main agents can create new custom sub-agents at runtime using the `build_sub_agent` tool. Dynamically created sub-agents are saved to SQLite and made immediately available for task delegation.
