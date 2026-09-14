# CEO Multi-Agent Orchestration (`gptloop/src/agents/multiagent/ceo`)

The `ceo` directory contains the top-level CEO orchestration runtime (`CeoAgentRunner`) for GPTLoop. CEO mode introduces enterprise-level multi-team coordination, where a strategic CEO agent controls multiple autonomous agent teams.

---

## 🎯 Architecture & Workflow

CEO mode operates at the highest level of multi-agent abstraction:

```
                            ┌───────────────────┐
                            │     CEO Agent     │
                            │  (Orchestrator)   │
                            └─────────┬─────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
      ┌────────────────────┐                    ┌────────────────────┐
      │   Team Leader A    │                    │   Team Leader B    │
      │  (Frontend Team)   │                    │   (Backend Team)   │
      └──────────┬─────────┘                    └──────────┬─────────┘
                 │                                         │
        ┌────────┴────────┐                       ┌────────┴────────┐
        ▼                 ▼                       ▼                 ▼
   ┌─────────┐       ┌─────────┐             ┌─────────┐       ┌─────────┐
   │ Member  │       │ Member  │             │ Member  │       │ Member  │
   └─────────┘       └─────────┘             └─────────┘       └─────────┘
```

1. **Strategic Planning:** The CEO receives complex, multi-system feature requests or project goals.
2. **Team Delegation:** The CEO delegates sub-projects to specific Team Leaders using `assign_tasks_to_teams`.
3. **Execution & Reporting:** Each Team Leader manages its worker members and reports milestone completion back to the CEO via `report_task_completion_to_ceo`.
4. **Synthesis:** The CEO verifies project deliverables across all teams and compiles a comprehensive project summary.

---

## 🛠️ CEO Specific Tools

- `assign_tasks_to_teams`: Assigns project components to team leaders.
- `report_task_completion_to_ceo`: Tool used by team leaders to report sub-project completion and deliverables back to the CEO.
- `get_team_members_status`: Queries progress across all active teams under CEO oversight.

---

## ⚙️ Configuration & UI

CEO setups are managed via the **CEO Panel** in the frontend UI and persisted in SQLite (`app_state` repository). Users can configure the CEO's prompt, select which teams are active, and monitor team hierarchy streams in real time.
