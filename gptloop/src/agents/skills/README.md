# Skills Architecture (`gptloop/src/agents/skills`)

The `skills` directory contains modular capability definitions (SKILL.md) and management logic that allow GPTLoop agents to dynamically load, initialize, or create specialized workflows.

---

## 🎯 What Are Skills?

Skills are modular, structured instruction sets packaged in `SKILL.md` format. They provide step-by-step methodologies, domain rules, and prompt patterns for specific software engineering tasks.

### Features:
- **On-Demand Loading:** Agents load skills into their active prompt context only when needed (`skill_initialize`).
- **Dynamic Creation:** Agents or users can create new skills at runtime (`createskill`).
- **Workspace Storage:** Skills are materialized in the workspace under `<workspace>/.gptloop/skills/`.
- **Modularity:** Keeps main agent system prompts clean while making rich domain expertise accessible.

---

## 📚 Built-In Skill Categories

GPTLoop includes the following built-in skills:

| Skill | Directory | Description |
| :--- | :--- | :--- |
| **Code Architect** | `code-architect/` | Architectural patterns, clean module separation, and system scalability guidelines. |
| **Code Reviewer** | `code-reviewer/` | Structured code audit criteria, performance checks, and security inspection steps. |
| **Debugger** | `debugger/` | Systematic root-cause analysis and bug isolation workflows. |
| **Deep Researcher** | `deep-researcher/` | Web and codebase deep investigation methodology. |
| **Information Analyst**| `information-analyst/` | Structured data analysis, schema parsing, and specification mapping. |
| **Integration Builder**| `integration-builder/` | API integration, webhooks, and third-party SDK connection workflows. |
| **Planner** | `planner/` | Project roadmap breakdown and task sequence generation. |
| **Problem Solver** | `problem-solver/` | Algorithmic logic design and step-by-step troubleshooting frameworks. |
| **Professional Writer**| `professional-writer/` | Documentation, technical writing, and release note drafting rules. |
| **Refactoring Expert** | `refactoring-expert/` | Code refactoring strategies, dead code removal, and clean code principles. |
| **Task Executor** | `task-executor/` | High-efficiency task execution and verification procedure. |

---

## 🔄 How Agents Use Skills

1. **Discovery:** The agent calls `list_skills` to see all available built-in and workspace-materialized skills.
2. **Initialization:** The agent calls `skill_initialize` with the target skill name. The skill's `SKILL.md` instructions are injected into the agent's turn context.
3. **Creation:** The agent can save new workflows using `createskill`, specifying a name, description, and markdown instruction body.
4. **Deletion:** Custom skills can be removed via `delete_skill`.
