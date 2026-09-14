# Multi-Agent Team Runtime (`gptloop/src/agents/multiagent`)

The `multiagent` directory implements hierarchical multi-agent team collaboration in GPTLoop. It allows complex software engineering tasks to be solved by structured teams consisting of a **Team Leader (Head)** and multiple **Worker Members**.

---

## 🎯 Architecture & Concepts

In Multi-Agent Team mode:

```
                      ┌──────────────────────┐
                      │     Team Leader      │
                      │    (Head Agent)      │
                      └──────────┬───────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Worker Agent 1  │    │  Worker Agent 2  │    │  Worker Agent 3  │
│  (e.g., Coder)   │    │  (e.g., Review)  │    │  (e.g., Tester)  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

1. **Team Leader (Head):** Decomposes user tasks, delegates work items to specific team members, collects progress updates, and formulates the final synthesized response.
2. **Team Members (Workers):** Specialized agents executing focused tasks in isolation and reporting status back to the team leader.
3. **Event Streaming:** All inter-agent communication, tool invocations, and thinking chains stream to the user console in real time via SSE.

---

## 🛠️ Multi-Agent Tools

Agents operating within a team use specific multi-agent coordination tools:

- `assign_tasks_to_teams`: Assigns structured tasks to designated team members.
- `send_message_to_team`: Sends a message or update to team members.
- `message_team_leader`: Allows worker members to send messages back to their team leader.
- `list_teams`: Lists available multi-agent teams.
- `list_agent_team_members`: Lists all members belonging to a team.
- `get_team_members_status`: Queries current activity status across team members.

---

## ⚙️ Team Configuration & Storage

Teams are stored in the SQLite database (`app_state` repository) and can be configured through the **Teams Panel** in the frontend UI. Each team defines:
- Team Name & ID
- Team Description
- Head Agent System Prompt & Tools
- Member Agent List, System Prompts & Capabilities
