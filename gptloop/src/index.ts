import express from "express";
import cors from "cors";
import { config, ensureWorkspace } from "./config.js";
import { createProviderRegistry } from "./agents/providers/registry.js";
import { createToolRegistry } from "./agents/tools/index.js";
import { AgentRunner } from "./agents/agent.js";
import { ChatRunner } from "./agents/chat.js";
import { SessionStore } from "./services/sessionStore.js";
import { PlanApprovalStore } from "./services/planApprovalStore.js";
import { QuestionStore } from "./services/questionStore.js";
import { buildChatRouter } from "./api/chat.js";
import { buildProviderRouter } from "./api/providers.js";
import { buildFilesRouter } from "./api/files.js";
import { buildWorkspaceRouter } from "./api/workspace.js";
import { buildScrapeRouter } from "./api/scrape.js";
import { buildStateRouter, buildSessionsRouter } from "./api/state.js";
import { buildToolsRouter } from "./api/tools.js";
import { buildMemoryAgentRouter } from "./api/memoryagent.js";
import { buildConnectorsRouter } from "./api/connectors.js";
import { buildMcpRouter } from "./api/mcp.js";
import { buildSystemPromptRouter } from "./api/systemprompt.js";
import { buildCustomAgentsRouter } from "./api/customagents.js";
import { buildUserProfilesRouter } from "./api/profiles.js";
import { buildMainAgentPromptsRouter } from "./api/mainagentprompts.js";
import { buildSchedulesRouter } from "./api/schedules.js";
import { ScheduleStore } from "./cron/store.js";
import { ScheduleRunner } from "./cron/runner.js";
import { ScheduleScheduler } from "./cron/scheduler.js";
import { MemoryAgentService } from "./agents/memoryagent/index.js";
import { MultiAgentRunner } from "./agents/multiagent/index.js";
import { CeoAgentRunner } from "./agents/multiagent/ceo/index.js";
import { CustomAgentManager, CustomAgentRunner } from "./agents/customagent/index.js";
import { UserProfileManager } from "./agents/profiles/index.js";
import { MainAgentPromptManager } from "./agents/mainagentprompt/index.js";
import { ConnectorManager } from "./agents/connectors/index.js";
import { McpManager } from "./agents/mcp/index.js";
import { GptLoopDatabase } from "./database/index.js";

function main(): void {
  ensureWorkspace();

  // The SQLite database (workspace/.gptloop/gptloop.db) is created automatically on boot.
  const db = GptLoopDatabase.open(config.workspaceRoot);

  const providers = createProviderRegistry();
  const tools = createToolRegistry();
  const store = new SessionStore();
  const planApprovals = new PlanApprovalStore();
  const askQuestions = new QuestionStore();
  // The background memory agent: runs entirely in the backend, triggered after every
  // completed main-agent turn, persisting everything into the local SQLite database.
  const memoryAgent = new MemoryAgentService(providers, tools, config, db);
  const mcp = new McpManager(db.appState, config);
  const agent = new AgentRunner(providers, tools, config, planApprovals, askQuestions, memoryAgent, mcp);
  // Chat mode: lightweight conversational assistant with only memory + knowledge + web tools.
  // Streams onto the same event buffer, so resume/replay/persistence work identically.
  const chatRunner = new ChatRunner(providers, tools, config, memoryAgent);
  // The multi-agent team runner: drives a whole agent team (head + members) for one chat turn,
  // streaming onto the same event buffer the single agent uses.
  const multiAgent = new MultiAgentRunner(providers, tools, config, mcp);
  // The CEO multi-agent runner: drives a CEO agent that controls the head/leaders of several agent
  // teams, streaming onto the same event buffer. Built on the same multi-agent runtime as the team runner.
  const ceoAgent = new CeoAgentRunner(providers, tools, config, mcp);
  // Custom Agents: user-created, independently-configured TOP-LEVEL Main Agents. The manager persists
  // their configs in the SQLite app_state repository; the runner executes them through the SAME core
  // runtime as the Main Agent (parameterized with each agent's system prompt + selected tools).
  const customAgents = new CustomAgentManager(db.appState);
  const customAgentRunner = new CustomAgentRunner(agent, tools, config);
  // User Profiles: identity records (name, description, logo avatar) plus the active
  // selection, persisted in the SQLite app_state repository. Each profile owns a fully
  // isolated workspace state (fresh chats/settings/memory/...); the isolation snapshots
  // live in the `profileStates` / `profileSessions` documents owned by the frontend.
  const userProfiles = new UserProfileManager(db.appState);
  userProfiles.ensureDefault();
  // Custom System Prompts for the built-in Main Agent: the manager persists named prompts + the
  // active selection in the SQLite app_state repository and is the source of truth for which prompt
  // the Main Agent runs with. It never creates a new agent — it only changes the Main Agent's system
  // prompt (see chat.ts, which applies the active prompt as a systemPromptOverride).
  const mainAgentPrompts = new MainAgentPromptManager(db.appState);
  // Connectors (Composio-powered app integrations): connection records live in the
  // SQLite app_state repository; the router serves connect/status/tools from them.
  const connectors = new ConnectorManager(db.appState);

  // Schedules (persistent cron): the store persists schedules + history in the
  // SQLite database; the runner executes due schedules through the EXISTING
  // agent runtime; the scheduler loads every active schedule at boot and fires
  // them on time with no browser open.
  const scheduleStore = new ScheduleStore(db.schedules, db.scheduleRuns);
  const scheduleRunner = new ScheduleRunner({
    providers,
    tools,
    config,
    db,
    store: scheduleStore,
    agent,
    customAgentRunner,
    customAgents,
    planApprovals,
    askQuestions,
    memoryAgent,
    mcpManager: mcp,
  });
  const scheduler = new ScheduleScheduler({ db, store: scheduleStore, runner: scheduleRunner });
  scheduler.start();

  const app = express();
  app.use(
    cors({
      origin: config.corsOrigins === "*" ? true : config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "25mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "gptloop",
      workspace: config.workspaceRoot,
      providers: providers.list().map((p) => p.id),
      tools: tools.schemas.map((s) => s.function.name),
      max_iterations: config.maxIterations,
      database: db.path,
      sqlite_version: db.version,
    });
  });

  app.use("/api/providers", buildProviderRouter(providers));
  app.use("/api/tools", buildToolsRouter(tools));
  app.use("/api/system-prompt", buildSystemPromptRouter(config));
  app.use("/api/custom-agents", buildCustomAgentsRouter(customAgents));
  app.use("/api/profiles", buildUserProfilesRouter(userProfiles));
  app.use("/api/main-agent-prompts", buildMainAgentPromptsRouter(mainAgentPrompts, config));
  app.use(
    "/api/chat",
    buildChatRouter(
      agent,
      store,
      config,
      planApprovals,
      askQuestions,
      db,
      multiAgent,
      ceoAgent,
      customAgents,
      customAgentRunner,
      mainAgentPrompts,
      connectors,
      mcp,
      chatRunner,
    ),
  );
  app.use("/api/files", buildFilesRouter(config));
  app.use("/api/workspace", buildWorkspaceRouter());
  app.use("/api/scrape", buildScrapeRouter(config));
  app.use("/api/state", buildStateRouter(db));
  app.use("/api/sessions", buildSessionsRouter(db));
  app.use("/api/memory-agent", buildMemoryAgentRouter(memoryAgent));
  app.use("/api/connectors", buildConnectorsRouter(connectors, config));
  app.use("/api/mcp", buildMcpRouter(mcp));
  app.use("/api/schedules", buildSchedulesRouter(scheduleStore, scheduler, db, customAgents));

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[gptloop] listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`[gptloop] workspace: ${config.workspaceRoot}`);
  });

  const shutdown = () => {
    // Stop the scheduler first so no new run starts during teardown.
    scheduler.stop();
    // Flush the write queue and checkpoint the WAL before exiting.
    void mcp.closeAll().catch(() => undefined);
    db.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
