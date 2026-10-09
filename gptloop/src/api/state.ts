import { Router, type Request, type Response } from "express";
import {
  type GptLoopDatabase,
  isAppStateKey,
  isSafeSessionId,
  createChatSessionId,
} from "../database/index.js";
import type { AppConfig } from "../config.js";
import type { SessionStore, StoredMessage } from "../services/sessionStore.js";
import { buildSystemPrompt } from "../agents/systemprompt.js";
import type { MainAgentPromptManager } from "../agents/mainagentprompt/index.js";

/**
 * State + session APIs backing the frontend's persistence. The browser keeps NOTHING
 * in localStorage anymore — on boot it hydrates from `GET /api/state`, and every
 * settings/skills/memory/knowledge/sub-agent/todo change is written back here into
 * the SQLite database. Conversation snapshots (the UI-shaped chat history) live in
 * `PUT/GET /api/sessions/:id`.
 */

export function buildStateRouter(db: GptLoopDatabase): Router {
  const router = Router();

  /** Everything the frontend needs to boot, in one round trip. */
  router.get("/", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      sqlite_version: db.version,
      state: db.appState.getAll(),
      // One indexed read — messageCount is maintained by the write queue, so boot
      // cost stays flat no matter how large the message/event tables grow.
      sessions: db.sessions.list().map((s) => ({
        id: s.id,
        title: s.title,
        running: s.running,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messageCount,
      })),
    });
  });

  /** Persist one application-state document (settings, skills, memory, ...). */
  const putState = (req: Request, res: Response): void => {
    const key = String(req.params.key);
    if (!isAppStateKey(key)) {
      res.status(400).json({ error: `Unknown state key "${key}".` });
      return;
    }
    const body = (req.body ?? {}) as { value?: unknown };
    db.appState.set(key, body.value ?? null);
    res.json({ ok: true });
  };
  router.put("/:key", putState);
  // POST alias so navigator.sendBeacon (POST-only) can flush state on page close.
  router.post("/:key", putState);

  return router;
}

export function buildSessionsRouter(
  db: GptLoopDatabase,
  deps?: {
    store?: SessionStore;
    config?: AppConfig;
    mainAgentPrompts?: MainAgentPromptManager;
  },
): Router {
  const router = Router();

  /** Create a new session with a server-generated 20-character id. */
  router.post("/", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
    const session = db.sessions.create(title);
    res.json({ ok: true, id: session.id, session });
  });

  router.get("/", (_req: Request, res: Response) => {
    res.json({ ok: true, sessions: db.sessions.list() });
  });

  /**
   * Raw context for one session's Main Agent: the resolved system prompt plus the
   * provider-format transcript (system + history + tools, untruncated) that the next
   * Main Agent request is built from. Served unformatted so the UI can display it raw.
   *
   * Query: `?agent=main` (default `main`). Only the Main Agent is supported at this
   * stage — any other scope returns 400 so the endpoint stays modular and other
   * agents can be added later without changing the route shape.
   *
   * Source preference: the live in-memory transcript when the session is active
   * (freshest during a running turn), else the persisted SQLite transcript, else an
   * empty context. The system prompt resolves to the active custom Main Agent prompt
   * when one is set, else the built-in prompt (neutral baseline: per-turn connector /
   * MCP / channel hints are turn-specific and not included). Never throws.
   */
  router.get("/:id/context", (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isSafeSessionId(id)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }
    const rawAgent = Array.isArray(req.query.agent) ? req.query.agent[0] : req.query.agent;
    const agent = typeof rawAgent === "string" && rawAgent.trim().length > 0 ? rawAgent.trim().toLowerCase() : "main";
    // Modular scope gate: main-only today, extensible to custom/team/ceo later.
    if (agent !== "main") {
      res.status(400).json({ error: `Only the main agent is supported at this stage (got "${agent}").` });
      return;
    }

    const liveMessages = (() => {
      try {
        const live = deps?.store?.get(id)?.messages;
        return Array.isArray(live) ? live : [];
      } catch {
        return [];
      }
    })();
    const persistedExists = (() => {
      try {
        return Boolean(db.sessions.get(id));
      } catch {
        return false;
      }
    })();
    if (!persistedExists && liveMessages.length === 0) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    let messages: StoredMessage[];
    let source: "live" | "persisted" | "empty";
    if (liveMessages.length > 0) {
      messages = liveMessages.map((m) => ({ ...m }));
      source = "live";
    } else {
      let persisted: StoredMessage[] = [];
      try {
        persisted = db.messages.list(id);
      } catch {
        persisted = [];
      }
      messages = persisted;
      source = persisted.length > 0 ? "persisted" : "empty";
    }

    let systemPrompt: string | null = null;
    let systemPromptSource: "custom" | "builtin" = "builtin";
    try {
      const active = deps?.mainAgentPrompts?.getActivePromptText() ?? null;
      if (typeof active === "string" && active.trim().length > 0) {
        systemPrompt = active;
        systemPromptSource = "custom";
      } else {
        systemPrompt = buildSystemPrompt(deps?.config?.workspaceRoot ?? "", {});
      }
    } catch {
      systemPrompt = null;
    }

    res.json({
      ok: true,
      agent: "main",
      sessionId: id,
      systemPrompt,
      systemPromptSource,
      messages,
      source,
      messageCount: messages.length,
      usage: latestMainContextUsage(db, id),
      fetchedAt: Date.now(),
    });
  });

  /** Full session detail: metadata, UI snapshot, and the provider-format transcript. */
  router.get("/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isSafeSessionId(id)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }
    const session = db.sessions.get(id);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({
      ok: true,
      session,
      snapshot: db.snapshots.get(id),
      transcript: db.messages.list(id),
      subAgentRuns: db.subAgentRuns.listBySession(id),
      // Latest main-agent context usage from the persisted stream-event log, so the
      // context meter survives refresh/reopen without a live stream. Null when the
      // session never logged main-agent usage (silent provider, old history, or a
      // thread that only ran other agents). Additive field — existing clients ignore it.
      contextUsage: latestMainContextUsage(db, id),
    });
  });

  /** Upsert a session: title rename and/or the UI conversation snapshot. */
  const putSession = (req: Request, res: Response): void => {
    const id = String(req.params.id);
    if (!isSafeSessionId(id)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }
    const body = (req.body ?? {}) as { title?: unknown; snapshot?: unknown };
    db.sessions.ensure(id);
    if (typeof body.title === "string") {
      db.sessions.rename(id, body.title.slice(0, 200));
    }
    if (body.snapshot !== undefined) {
      db.snapshots.set(id, body.snapshot);
    }
    res.json({ ok: true });
  };
  router.put("/:id", putSession);
  // POST alias so navigator.sendBeacon (POST-only) can flush snapshots on page close.
  router.post("/:id", putSession);

  router.delete("/:id", (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isSafeSessionId(id)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }
    db.sessions.delete(id);
    res.json({ ok: true });
  });

  /**
   * Fork a session: full 100% copy of the source session's stored chat data
   * (transcript, events, tool calls, UI snapshot) into a new session.
   * Body: { title?: string, new_id?: string }. When new_id is a valid unused
   * session id it is used verbatim so the frontend and backend stay in sync;
   * otherwise a server-generated 20-char id is used. Global settings/memory/
   * skills/teams are shared by design, so the fork automatically inherits them.
   */
  router.post("/:id/fork", (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isSafeSessionId(id)) {
      res.status(400).json({ error: "Invalid session id." });
      return;
    }
    const body = (req.body ?? {}) as { title?: unknown; new_id?: unknown; newId?: unknown };
    const title = typeof body.title === "string" ? body.title.slice(0, 200) : undefined;
    const rawNewId = typeof body.new_id === "string" ? body.new_id : typeof body.newId === "string" ? body.newId : undefined;
    const forked = db.forkSession(id, { title, newId: rawNewId });
    if (!forked) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.json({ ok: true, id: forked.id, session: forked });
  });

  return router;
}

/** Re-exported so callers can mint ids without touching the database module directly. */
export { createChatSessionId };

/**
 * Newest main-agent `context_usage` log entry for a session, sanitized for the meter.
 * Picks the newest logged row tagged `agent: "main"` (custom-agent rows are valid log
 * data for future use — never served as main-agent usage). Returns null when there is
 * nothing usable, so the UI shows "unavailable" rather than a fabricated number.
 * Never throws: persistence reads must not break session loading.
 */
function latestMainContextUsage(
  db: GptLoopDatabase,
  sessionId: string,
): Record<string, unknown> | null {
  try {
    const rows = db.events.latestContextUsage(sessionId, 25);
    for (const row of rows) {
      const data = row.data ?? {};
      const scope = typeof data.agent === "string" ? data.agent.trim().toLowerCase() : "";
      if (scope !== "main") continue;
      const prompt_tokens = cleanCount(data.prompt_tokens);
      if (prompt_tokens === undefined) continue;
      const out: Record<string, unknown> = { agent: "main", prompt_tokens };
      const completion_tokens = cleanCount(data.completion_tokens);
      if (completion_tokens !== undefined) out.completion_tokens = completion_tokens;
      const total_tokens = cleanCount(data.total_tokens);
      if (total_tokens !== undefined) out.total_tokens = total_tokens;
      if (typeof data.provider === "string" && data.provider.trim().length > 0) {
        out.provider = data.provider.trim().slice(0, 120);
      }
      if (typeof data.model === "string" && data.model.trim().length > 0) {
        out.model = data.model.trim().slice(0, 200);
      }
      const iteration = cleanCount(data.iteration);
      if (iteration !== undefined) out.iteration = iteration;
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

/** A finite, non-negative token count (zero is legitimate; NaN/negative is not). */
function cleanCount(value: unknown): number | undefined {
  const n =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}
