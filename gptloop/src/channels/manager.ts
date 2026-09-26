import type { AppConfig } from "../config.js";
import type { ProviderRegistry } from "../agents/providers/registry.js";
import type { ToolRegistry } from "../agents/tools/registry.js";
import type { AgentRunner } from "../agents/agent.js";
import type { CustomAgentRunner, CustomAgentManager } from "../agents/customagent/index.js";
import type { MainAgentPromptManager } from "../agents/mainagentprompt/index.js";
import type { PlanApprovalStore } from "../services/planApprovalStore.js";
import type { McpManager } from "../agents/mcp/index.js";
import type { MemoryAgentService } from "../agents/memoryagent/index.js";
import type { GptLoopDatabase } from "../database/index.js";
import type { ChannelChatRow } from "../database/repositories/channelChatsRepo.js";
import { createChatSessionId } from "../database/ids.js";
import { ChannelStore } from "./store.js";
import { ChannelTurnRunner } from "./runner.js";
import { TelegramProvider, verifyTelegramToken } from "./providers/telegram.js";
import { DiscordProvider, verifyDiscordToken } from "./providers/discord.js";
import { SlackProvider, verifySlackToken } from "./providers/slack.js";
import type {
  ChannelConnectionPublic,
  ChannelIncoming,
  ChannelKind,
  ChannelSender,
  ChannelTarget,
} from "./types.js";
import { isChannelKind } from "./types.js";

export interface ChannelManagerDeps {
  providers: ProviderRegistry;
  tools: ToolRegistry;
  config: AppConfig;
  db: GptLoopDatabase;
  agent: AgentRunner;
  customAgentRunner: CustomAgentRunner;
  customAgents: CustomAgentManager;
  mainAgentPrompts: MainAgentPromptManager;
  planApprovals: PlanApprovalStore;
  memoryAgent?: MemoryAgentService;
  mcpManager?: McpManager;
}

interface LiveChannel {
  connectionId: string;
  stop: () => void;
}

/**
 * Owns every messaging-channel connection: validates tokens, runs the provider
 * transports, routes inbound traffic into ChannelTurnRunner, and exposes the
 * dashboard surface (connections, chats, agent selection). Started once at boot;
 * each enabled connection runs independently until stopped, deleted, or disabled.
 */
export class ChannelManager {
  readonly store: ChannelStore;
  private readonly runner: ChannelTurnRunner;
  private readonly live = new Map<string, LiveChannel>();
  /** Consecutive runtime failures per channel (marks error only when sustained). */
  private readonly failures = new Map<string, number>();
  private scheduleStore?: import("../cron/store.js").ScheduleStore;
  private scheduleScheduler?: import("../cron/scheduler.js").ScheduleScheduler;
  private closed = false;

  constructor(private readonly deps: ChannelManagerDeps) {
    this.store = new ChannelStore(deps.db.appState);
    this.runner = new ChannelTurnRunner({
      providers: deps.providers,
      tools: deps.tools,
      config: deps.config,
      db: deps.db,
      store: this.store,
      agent: deps.agent,
      customAgentRunner: deps.customAgentRunner,
      customAgents: deps.customAgents,
      mainAgentPrompts: deps.mainAgentPrompts,
      planApprovals: deps.planApprovals,
      memoryAgent: deps.memoryAgent,
      mcpManager: deps.mcpManager,
      scheduleStore: this.scheduleStore,
      scheduleScheduler: this.scheduleScheduler,
    });
  }

  /**
   * Attach the persistent schedule store + background scheduler (called once at boot).
   * Channel turns go through the shared AgentRunner, so schedule_* tools work there too.
   */
  setSchedules(
    store?: import("../cron/store.js").ScheduleStore,
    scheduler?: import("../cron/scheduler.js").ScheduleScheduler,
  ): void {
    this.scheduleStore = store;
    this.scheduleScheduler = scheduler;
  }

  /** Start every enabled connection (called once at boot). Never throws. */
  async start(): Promise<void> {
    for (const connection of this.store.list()) {
      if (connection.enabled && connection.token) {
        await this.startChannel(connection.id);
      } else if (connection.enabled && !connection.token) {
        this.store.markStatus(connection.id, "error", { lastError: "No bot token configured." });
      }
    }
  }

  /** Stop every live provider (shutdown path). */
  async shutdown(): Promise<void> {
    this.closed = true;
    for (const [id, live] of this.live) {
      try {
        live.stop();
      } catch {
        // best effort
      }
      this.live.delete(id);
    }
  }

  /** The database (used by the API layer for chat/message reads). */
  get db(): GptLoopDatabase {
    return this.deps.db;
  }

  // ---- Dashboard surface ------------------------------------------------------

  listPublic(): ChannelConnectionPublic[] {
    const counts = new Map<string, number>();
    for (const connection of this.store.list()) {
      counts.set(connection.id, this.deps.db.channelChats.count(connection.id));
    }
    return this.store.listPublic(counts);
  }

  getPublic(id: string): ChannelConnectionPublic | null {
    const connection = this.store.get(id);
    if (!connection) return null;
    return this.store.listPublic(
      new Map([[id, this.deps.db.channelChats.count(id)]]),
    )[0] ?? null;
  }

  /**
   * Create a connection: validates the token against the provider (resolving the bot
   * name/id), persists the connection, and starts it. Throws with a human message.
   */
  async createChannel(input: {
    kind?: unknown;
    name?: unknown;
    token?: unknown;
  }): Promise<ChannelConnectionPublic> {
    const kindRaw = typeof input.kind === "string" ? input.kind.trim().toLowerCase() : "";
    if (!isChannelKind(kindRaw)) {
      throw new Error(
        `Unknown channel "${String(input.kind ?? "")}". WhatsApp is coming soon — use Telegram instead.`,
      );
    }
    const kind: ChannelKind = kindRaw;
    const token = typeof input.token === "string" ? input.token.trim() : "";
    if (!token) throw new Error("A bot token is required.");
    const verified = await this.verifyToken(kind, token);

    // The user's currently active Custom Agent (if any) serves new channel chats initially.
    const activeCustomAgentId = this.activeCustomAgentId();
    const initialAgent = this.store.resolveInitialAgent(this.deps.customAgents, activeCustomAgentId);

    const connection = this.store.create({
      kind,
      name: typeof input.name === "string" ? input.name : undefined,
      token,
      botName: verified.botName,
      botId: verified.botId,
      activeAgentId: initialAgent,
    });
    await this.startChannel(connection.id);
    return this.getPublic(connection.id)!;
  }

  /**
   * Update a connection (rename, replace the token, enable/disable). A fresh token is
   * re-validated before it is stored; enabling starts the provider, disabling stops it.
   */
  async updateChannel(
    id: string,
    patch: { name?: unknown; token?: unknown; enabled?: unknown },
  ): Promise<ChannelConnectionPublic> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Channel not found.");

    let botPatch: { botName?: string; botId?: string } | undefined;
    if (typeof patch.token === "string" && patch.token.trim().length > 0) {
      const verified = await this.verifyToken(existing.kind, patch.token.trim());
      botPatch = { botName: verified.botName, botId: verified.botId };
    }
    const enabled =
      typeof patch.enabled === "boolean"
        ? patch.enabled
        : patch.enabled === "yes" || patch.enabled === "on"
          ? true
          : patch.enabled === "no" || patch.enabled === "off"
            ? false
            : undefined;
    const updated = this.store.update(id, {
      ...(typeof patch.name === "string" ? { name: patch.name } : {}),
      ...(typeof patch.token === "string" && patch.token.trim() ? { token: patch.token } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    });
    if (!updated) throw new Error("Channel not found.");
    if (botPatch) this.store.markStatus(id, updated.status, botPatch);

    // Restart the provider when it is enabled with a (possibly new) token.
    const fresh = this.store.get(id)!;
    this.stopLive(id);
    if (fresh.enabled && fresh.token) {
      await this.startChannel(id);
    } else if (fresh.enabled && !fresh.token) {
      this.store.markStatus(id, "error", { lastError: "No bot token configured." });
    } else {
      this.store.markStatus(id, "disabled");
    }
    return this.getPublic(id)!;
  }

  /** Delete a connection, its chats, and their transcripts. Returns true when removed. */
  async deleteChannel(id: string): Promise<boolean> {
    this.stopLive(id);
    const chats = this.deps.db.channelChats.listByChannel(id);
    for (const chat of chats) {
      this.deps.db.channelMessages.deleteByChatId(chat.id);
    }
    this.deps.db.channelChats.deleteByChannel(id);
    this.failures.delete(id);
    return this.store.delete(id);
  }

  /** Start the provider transport for one connection (idempotent). */
  async startChannel(id: string): Promise<void> {
    if (this.closed) return;
    const connection = this.store.get(id);
    if (!connection || !connection.enabled || !connection.token) return;
    this.stopLive(id);
    this.store.markStatus(id, "connecting");
    this.failures.set(id, 0);

    // The provider IS the outbound sender: replies always travel on the same live
    // transport that received the message (token swaps restart the provider, so the
    // closure below always captures the current instance).
    const deliver = (
      send: (target: ChannelTarget, text: string) => Promise<void>,
      sendFile: (
        target: ChannelTarget,
        file: { absolutePath: string; filename: string; contentType: string },
      ) => Promise<void>,
    ): ChannelSender => ({ sendMessage: send, sendFile });
    const route = (sender: ChannelSender, incoming: ChannelIncoming): void => {
      this.failures.set(id, 0);
      // The provider is demonstrably alive when it delivers — heal a stale error
      // status so the dashboard reflects reality without a restart.
      const current = this.store.get(id);
      if (current && current.status === "error") {
        this.store.markStatus(id, "connected");
      }
      // Fire-and-forget per message; the runner serializes turns per chat internally.
      void this.runner
        .handleIncoming(this.store.get(id) ?? connection, sender, incoming)
        .catch((error) => {
          this.reportFailure(id, error instanceof Error ? error.message : String(error));
        });
    };
    const onError = (message: string): void => {
      this.reportFailure(id, message);
    };

    try {
      if (connection.kind === "telegram") {
        // Dead tokens are caught here (not in the poll loop) so the dashboard shows
        // the error immediately instead of "connecting" forever.
        const me = await verifyTelegramToken(connection.token).catch(() => null);
        if (!me) {
          this.store.markStatus(id, "error", { lastError: "Telegram rejected the bot token." });
          return;
        }
        if (me.botName !== connection.botName || me.botId !== connection.botId) {
          this.store.markStatus(id, "connecting", { botName: me.botName, botId: me.botId });
        }
        const provider = new TelegramProvider({
          token: connection.token,
          workspaceRoot: this.deps.config.workspaceRoot,
          onMessage: (incoming) =>
            route(
              deliver(
                (target, text) => provider.sendMessage(target, text),
                (target, file) => provider.sendFile(target, file),
              ),
              incoming,
            ),
          onError,
        });
        this.live.set(id, {
          connectionId: id,
          stop: () => provider.stop(),
        });
        void provider.start().catch((error) => {
          this.reportFailure(id, error instanceof Error ? error.message : String(error));
        });
      } else if (connection.kind === "discord") {
        const provider = new DiscordProvider({
          token: connection.token,
          workspaceRoot: this.deps.config.workspaceRoot,
          onMessage: (incoming) =>
            route(
              deliver(
                (target, text) => provider.sendMessage(target, text),
                (target, file) => provider.sendFile(target, file),
              ),
              incoming,
            ),
          onError,
        });
        this.live.set(id, {
          connectionId: id,
          stop: () => provider.stop(),
        });
        // Refresh bot identity (handles token swaps without a dashboard round-trip).
        const me = await verifyDiscordToken(connection.token).catch(() => null);
        if (me) this.store.markStatus(id, "connecting", { botName: me.botName, botId: me.botId });
        void provider.start().catch((error) => {
          this.reportFailure(id, error instanceof Error ? error.message : String(error));
        });
      } else {
        const provider = new SlackProvider({
          token: connection.token,
          workspaceRoot: this.deps.config.workspaceRoot,
          onMessage: (incoming) =>
            route(
              deliver(
                (target, text) => provider.sendMessage(target, text),
                (target, file) => provider.sendFile(target, file),
              ),
              incoming,
            ),
          onError,
        });
        this.live.set(id, {
          connectionId: id,
          stop: () => provider.stop(),
        });
        const me = await verifySlackToken(connection.token).catch(() => null);
        if (me) this.store.markStatus(id, "connecting", { botName: me.botName, botId: me.botId });
        void provider.start().catch((error) => {
          this.reportFailure(id, error instanceof Error ? error.message : String(error));
        });
      }
      this.store.markStatus(id, "connected");
    } catch (error) {
      this.reportFailure(id, error instanceof Error ? error.message : String(error));
    }
  }

  /** Set the agent serving NEW chats on a channel (Custom Agent id, "main", or null). */
  setChannelAgent(id: string, agentId: string | null): ChannelConnectionPublic {
    const resolved = this.resolveAgentId(agentId);
    const updated = this.store.setActiveAgent(id, resolved);
    if (!updated) throw new Error("Channel not found.");
    return this.getPublic(id)!;
  }

  /** Switch the agent serving one existing chat. */
  setChatAgent(chatId: string, agentId: string | null): ChannelChatRow {
    const chat = this.deps.db.channelChats.get(chatId);
    if (!chat) throw new Error("Chat not found.");
    const resolved = this.resolveAgentId(agentId);
    this.deps.db.channelChats.setAgent(chatId, resolved);
    return this.deps.db.channelChats.get(chatId)!;
  }

  /** Start a fresh chat for an external user (dashboard "new chat"). */
  newChatForUser(channelId: string, userKey: string): ChannelChatRow {
    const connection = this.store.get(channelId);
    if (!connection) throw new Error("Channel not found.");
    const now = Date.now();
    const latest = this.deps.db.channelChats.latestForUser(channelId, userKey);
    const row: ChannelChatRow = {
      id: createChatSessionId(),
      channelId,
      userKey,
      userLabel: latest?.userLabel ?? userKey,
      agentId: latest?.agentId ?? connection.activeAgentId,
      title: "",
      createdAt: now,
      updatedAt: now,
    };
    this.deps.db.channelChats.save(row);
    return row;
  }

  listChats(channelId: string): ChannelChatRow[] {
    return this.deps.db.channelChats.listByChannel(channelId);
  }

  // ---- Internals --------------------------------------------------------------

  private stopLive(id: string): void {
    const live = this.live.get(id);
    if (!live) return;
    try {
      live.stop();
    } catch {
      // best effort
    }
    this.live.delete(id);
  }

  /** Validate a token against its provider, resolving the bot name/id. Never stores. */
  private async verifyToken(
    kind: ChannelKind,
    token: string,
  ): Promise<{ botName: string; botId: string }> {
    if (kind === "telegram") return verifyTelegramToken(token);
    if (kind === "discord") return verifyDiscordToken(token);
    return verifySlackToken(token);
  }

  /** Currently active Custom Agent id in the app (null = Default Agent). */
  private activeCustomAgentId(): string | null {
    try {
      const raw = this.deps.db.appState.get("activeCustomAgentId");
      return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
    } catch {
      return null;
    }
  }

  /** Normalize a dashboard agent selection ("main"/null = Default Agent). */
  private resolveAgentId(agentId: string | null): string | null {
    if (!agentId || agentId === "main" || agentId === "default") return null;
    const found = this.deps.customAgents.get(agentId.trim());
    if (!found) throw new Error(`Unknown agent "${agentId}".`);
    return found.id;
  }

  private reportFailure(id: string, message: string): void {
    const count = (this.failures.get(id) ?? 0) + 1;
    this.failures.set(id, count);
    // Only mark the connection down on sustained failure (3+) so transient network
    // blips never flip the dashboard status.
    if (count >= 3) {
      this.store.markStatus(id, "error", { lastError: message.slice(0, 300) });
    }
  }
}
