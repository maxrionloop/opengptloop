import { Router, type Request, type Response } from "express";
import { getHandoffHistory } from "../agents/summarization/index.js";
import { isSafeSessionId } from "../database/index.js";

/**
 * Summaries API — past automatic context-summarization runs in a session.
 *
 * The handoff history is recorded backend-side on every terminal handoff
 * outcome (success or failure) and served here so the UI history button can
 * list past runs without replaying every turn's event log:
 *
 *   GET /api/summaries/history/:chatId  past runs, oldest first (bounded)
 */

export function buildSummaryRouter(): Router {
  const router = Router();

  router.get("/history/:chatId", (req: Request, res: Response) => {
    const chatId = String(req.params.chatId);
    if (!isSafeSessionId(chatId)) {
      res.status(400).json({ error: "Invalid chat id." });
      return;
    }
    const history = getHandoffHistory(chatId).map((r) => ({
      handoff_id: r.handoffId,
      chat_id: r.chatId,
      state: r.state,
      summary: r.summary,
      summary_chars: r.summaryChars,
      latest_user_input: r.latestUserInput,
      code: r.code,
      error: r.error,
      created_at: r.createdAt,
      finished_at: r.finishedAt,
    }));
    res.json({ ok: true, chat_id: chatId, count: history.length, history });
  });

  return router;
}
