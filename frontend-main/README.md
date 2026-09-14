# GPTLoop Frontend Console ("Haku")

`frontend-main` is the streaming-first web console for GPTLoop AI, codenamed **Haku**. Built with Vite, React 19, Tailwind CSS v4, and Zustand state management, it provides an interactive user interface for monitoring agent activity, executing tasks, managing memory, and configuring multi-agent team hierarchies.

---

## 🎯 Purpose & Capabilities

The frontend console enables users to:

1. **Interact with Agents in Real-Time:** Submit coding tasks and watch thinking chains, tool calls, shell executions, and responses stream live via Server-Sent Events (SSE).
2. **Switch Execution Modes:** Easily toggle between **Main Agent**, **Multi-Agent Team**, and **CEO Orchestration** modes directly from the prompt composer.
3. **Interactive Plan Approval & Clarification:** Review and approve proposed execution plans (`SubmitPlanBlock`) and answer clarification questions (`AskQuestionBlock`) mid-task.
4. **Manage Memory & Knowledge:** Inspect automatically extracted background memories, view memory agent session logs, and manually add, edit, or search knowledge items.
5. **Configure Custom Agents & Prompts:** Create user-defined custom top-level agents and manage system prompt variations for the main agent.
6. **Workspace & File Preview:** Browse workspace file trees, view file contents, and inspect generated artifacts in a dedicated preview panel.
7. **Monitor Process Execution & Todos:** View active background shell processes, monitor inter-agent team messages, and track task todos.

---

## 🖼️ UI Components & Panel Overlays

```
frontend-main/src/
├── app/                      # App root, main workspace layout & API routes mapping
│   ├── App.tsx               # Main application container
│   ├── main.tsx              # React entrypoint
│   └── globals.css           # Tailwind v4 styles
├── components/
│   ├── Rail.tsx              # Navigation rail for panel switching
│   ├── TopBar.tsx            # Session control, workspace switcher & settings button
│   ├── Composer.tsx          # Task input area, attachment handling & mode selector
│   ├── chat/                 # Chat log, tool chips, plan approval & question blocks
│   │   ├── ChatPanel.tsx     # Message list container
│   │   ├── ToolChip.tsx      # Tool execution status widget
│   │   ├── SubmitPlanBlock.tsx# Plan approval UI block
│   │   ├── AskQuestionBlock.tsx# User question block
│   │   └── TeamRunView.tsx   # Multi-agent team run timeline
│   ├── overlays/             # Floating drawer panels
│   │   ├── FilesPanel.tsx    # Workspace file explorer
│   │   ├── PreviewPanel.tsx  # Code & document previewer
│   │   ├── TodoPanel.tsx     # Task checklist view
│   │   ├── TeamMonitorPanel.tsx # Team activity monitor
│   │   ├── MemoryAgentPanel.tsx # Memory agent trigger & status
│   │   └── MemoryAgentSessionsPanel.tsx # Memory run history
│   ├── panels/               # Main workspace side-panels
│   │   ├── MemoryPanel.tsx   # Short/long-term memory view
│   │   ├── KnowledgePanel.tsx# Searchable knowledge base
│   │   ├── SkillsPanel.tsx   # Materialized skills inspector
│   │   ├── CustomAgentsPanel.tsx # Custom agent builder
│   │   ├── MainAgentPromptsPanel.tsx # System prompt selector
│   │   ├── TeamsPanel.tsx    # Multi-agent team editor
│   │   └── CeoPanel.tsx      # CEO agent manager
│   └── editors/
│       └── SettingsModal.tsx # LLM provider, API key & search engine modal
├── store/
│   └── useStore.ts           # Central Zustand state store
└── lib/                      # SSE stream handling, API client & backend synchronization
```

---

## 🔌 API & Backend Communication

The frontend communicates with the backend via REST endpoints and SSE streams. In development mode, Vite automatically proxies all `/api/*` network requests to the backend server running at `http://localhost:8787`.

- **Proxy Configuration:** Defined in `vite.config.ts`.
- **SSE Stream Handler:** Implemented in `src/lib/chatStream.ts` and `src/hooks/useChatStream.ts`.

---

## 🛠️ Key Commands

Run these commands inside the `frontend-main` directory:

```bash
# Install frontend dependencies
npm install

# Start Vite development server (http://localhost:5173)
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview

# Run TypeScript type checker across workspace
npm run typecheck

# Run oxlint linter
npm run lint
```

---

## ⚙️ Environment Variables

Optional client-side configuration can be placed in `frontend-main/.env`:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_PORT` | Development server port | `5173` |
| `GPTLOOP_API_URL` | Explicit backend URL override (if not using dev proxy) | `http://localhost:8787` |
