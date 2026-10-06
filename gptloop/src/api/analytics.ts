import { Router, type Request, type Response } from "express";
import { analytics } from "../services/analytics.js";
import type { GptLoopDatabase } from "../database/index.js";
import type { SessionStore } from "../services/sessionStore.js";
import { contentToText, estimateMessagesTokens } from "../tokens.js";

/**
 * Analytics & Logs API (read-only for the dashboard).
 *
 * - GET /api/analytics/stats  — aggregate totals (tokens, success/error,
 *   latency, cost, per-provider/model breakdowns, recent activity).
 * - GET /api/analytics/logs   — paginated log list with filters + search.
 * - GET /api/analytics/logs/:id — one log with full metadata.
 * - GET /api/analytics/providers — distinct providers (for filter dropdowns).
 * - GET /api/analytics/context?sessionId= — estimate one session's LLM
 *   context-window usage (transcript size + last prompt size).
 * - DELETE /api/analytics    — clear logs (analytics-only; never touches
 *   agent transcripts, settings, or any operational data).
 *
 * The dashboard polls these endpoints. Nothing here mutates agent state —
 * the agent's normal operation is unaffected by dashboard reads.
 */

function strParam(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numParam(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return undefined;
}

export function buildAnalyticsRouter(db: GptLoopDatabase, store?: SessionStore): Router {
  const router = Router();

  router.get("/stats", (req: Request, res: Response) => {
    try {
      const stats = analytics.stats({
        sessionId: strParam(req.query.sessionId ?? req.query.session_id),
        provider: strParam(req.query.provider),
        since: numParam(req.query.since),
      });
      res.json({ ok: true, stats });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get("/logs", (req: Request, res: Response) => {
    try {
      const status = strParam(req.query.status);
      const tokenSource = strParam(req.query.tokenSource ?? req.query.token_source);
      const { logs, totalInMemory } = analytics.list({
        sessionId: strParam(req.query.sessionId ?? req.query.session_id),
        provider: strParam(req.query.provider),
        model: strParam(req.query.model),
        status: status === "success" || status === "error" ? status : undefined,
        tokenSource:
          tokenSource === "provider" || tokenSource === "estimated" ? tokenSource : undefined,
        agentType: strParam(req.query.agentType ?? req.query.agent_type),
        search: strParam(req.query.search ?? req.query.q),
        since: numParam(req.query.since),
        limit: numParam(req.query.limit) ?? 100,
        offset: numParam(req.query.offset) ?? 0,
      });
      res.json({ ok: true, logs, totalInMemory });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get("/logs/:id", (req: Request, res: Response) => {
    try {
      const log = analytics.getById(String(req.params.id));
      if (!log) {
        res.status(404).json({ ok: false, error: "Log not found." });
        return;
      }
      res.json({ ok: true, log });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get("/providers", (req: Request, res: Response) => {
    try {
      const providers = analytics.distinctProviders(
        strParam(req.query.sessionId ?? req.query.session_id),
      );
      res.json({ ok: true, providers });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  /**
   * Estimate one chat session's LLM context-window usage (read-only).
   *
   * - The transcript is read live from the in-memory session when the backend
   *   currently holds it (exact, including the in-flight turn), otherwise from
   *   the persisted SQLite transcript.
   * - `transcriptTokens` is the built-in-counter estimate of the transcript
   *   alone (no system prompt, no tool schemas).
   * - `lastPromptTokens` is the most recent LLM call's input size for this
   *   session: the provider's ACTUAL prompt count when it reported usage
   *   (includes system prompt + tools), otherwise the built-in estimate of
   *   that call (which also included system prompt + tools).
   * - `usedTokens` is the best current-context figure: the last prompt size
   *   when a call was logged, else the transcript estimate.
   */
  router.get("/context", (req: Request, res: Response) => {
    try {
      const sessionId = strParam(req.query.sessionId ?? req.query.session_id);
      if (!sessionId) {
        res.status(400).json({ ok: false, error: "sessionId is required." });
        return;
      }

      let transcript: Array<Record<string, unknown>> = [];
      let live = false;
      try {
        const session = store?.get(sessionId);
        if (session && session.messages.length > 0) {
          transcript = session.messages as unknown as Array<Record<string, unknown>>;
          live = true;
        } else {
          transcript = db.messages.list(sessionId) as unknown as Array<Record<string, unknown>>;
        }
      } catch {
        transcript = [];
      }

      let userMessages = 0;
      let assistantMessages = 0;
      let toolMessages = 0;
      let chars = 0;
      for (const message of transcript) {
        if (!message || typeof message !== "object") continue;
        const role = typeof message.role === "string" ? message.role : "";
        if (role === "user") userMessages += 1;
        else if (role === "assistant") assistantMessages += 1;
        else if (role === "tool") toolMessages += 1;
        try {
          chars += contentToText(message.content).length;
        } catch {
          // Per-message accounting must never fail the whole read.
        }
      }
      const transcriptTokens = estimateMessagesTokens(transcript);

      let lastPromptTokens: number | null = null;
      let lastPromptSource: "provider" | "estimated" | null = null;
      let lastModel: string | null = null;
      let lastProvider: string | null = null;
      let lastTimestamp: number | null = null;
      try {
        const { logs } = analytics.list({ sessionId, limit: 20 });
        const last = logs.find((l) => l.kind === "llm_request" && l.inputTokens != null);
        if (last) {
          lastPromptTokens = last.inputTokens;
          lastPromptSource = last.tokenSource === "provider" ? "provider" : "estimated";
          lastModel = last.model;
          lastProvider = last.provider;
          lastTimestamp = last.timestamp;
        }
      } catch {
        // Analytics lookup failure still leaves the transcript estimate usable.
      }

      res.json({
        ok: true,
        context: {
          sessionId,
          live,
          messageCount: transcript.length,
          userMessages,
          assistantMessages,
          toolMessages,
          chars,
          transcriptTokens,
          lastPromptTokens,
          lastPromptSource,
          lastModel,
          lastProvider,
          lastTimestamp,
          usedTokens: lastPromptTokens ?? transcriptTokens,
          usedSource: lastPromptTokens != null ? (lastPromptSource ?? "estimated") : "transcript",
        },
      });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.delete("/", (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as { sessionId?: unknown };
      const sessionId =
        strParam(body.sessionId) ?? strParam(req.query.sessionId ?? req.query.session_id);
      analytics.clear(sessionId);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
