# Application Services (`gptloop/src/services`)

The `services` directory provides in-memory state coordination and async synchronization primitives for GPTLoop's Express backend.

---

## 🎯 Application Services Overview

Services in this directory bridge HTTP API routes, agent execution runtimes, and real-time user interactions:

```
gptloop/src/services/
├── sessionStore.ts           # Active chat session state tracking
├── planApprovalStore.ts      # Plan approval async decision coordinator
├── questionStore.ts          # Interactive user question/answer coordinator
└── eventBuffer.ts            # SSE event stream buffer & dispatch manager
```

---

## 🧩 Key Service Components

### 1. `PlanApprovalStore` (`planApprovalStore.ts`)
Coordinates human-in-the-loop plan verification when an agent calls the `submit_plan` tool:
- Registers pending plan approvals with unique IDs.
- Pauses agent turn execution while waiting for a user decision via `POST /api/chat/plan-approval/decision`.
- Enforces `PLAN_APPROVAL_TIMEOUT_MS` (default: 60 seconds). If the user does not respond within the timeout, the agent proceeds autonomously.

### 2. `QuestionStore` (`questionStore.ts`)
Coordinates user clarification questions when an agent calls `ask_question_to_user`:
- Holds pending question promises during agent execution.
- Resolves when the user submits answers via `POST /api/chat/question/answer`.
- Enforces `QUESTION_TIMEOUT_MS` (default: 180 seconds).

### 3. `EventBuffer` (`eventBuffer.ts`)
Manages the real-time event pipeline for Server-Sent Events (SSE):
- Buffers agent execution events (`thought`, `tool_call`, `tool_result`, `process_output`).
- Dispatches formatted SSE chunks to connected HTTP stream clients.

### 4. `SessionStore` (`sessionStore.ts`)
Maintains in-memory pointers to active chat sessions and execution turns across API calls.
