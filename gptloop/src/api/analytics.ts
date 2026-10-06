import { Router, type Request, type Response } from "express";
import { analytics } from "../services/analytics.js";
import type { GptLoopDatabase } from "../database/index.js";

/**
 * Analytics & Logs API (read-only for the dashboard).
 *
 * - GET /api/analytics/stats  — aggregate totals (tokens, success/error,
 *   latency, cost, per-provider/model breakdowns, recent activity).
 * - GET /api/analytics/logs   — paginated log list with filters + search.
 * - GET /api/analytics/logs/:id — one log with full metadata.
 * - GET /api/analytics/providers — distinct providers (for filter dropdowns).
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

export function buildAnalyticsRouter(_db: GptLoopDatabase): Router {
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
