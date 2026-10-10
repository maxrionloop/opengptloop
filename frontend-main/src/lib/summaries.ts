import { API_ROUTES, routeUrl } from "@/app/api/routes";
import { requestJson } from "@/lib/api";

export interface SummaryHistoryItem {
  handoff_id: string;
  chat_id: string;
  state: string;
  summary: string | null;
  summary_chars: number | null;
  latest_user_input: string | null;
  code: string | null;
  error: string | null;
  created_at: number;
  finished_at: number;
}

/** Past summarization runs for a chat session, oldest first (bounded backend-side). */
export async function fetchSummaryHistory(chatId: string): Promise<SummaryHistoryItem[]> {
  const data = await requestJson<{ history?: SummaryHistoryItem[] }>(
    routeUrl(API_ROUTES.summariesHistory, { params: { chatId } }),
  );
  return Array.isArray(data.history) ? data.history : [];
}
