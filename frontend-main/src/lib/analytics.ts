import { API_ROUTES, routeUrl } from "@/app/api/routes";
import { requestJson } from "@/lib/api";

/**
 * Client for the read-only Analytics & Logs API. The dashboard never mutates
 * agent state — it only reads usage logs/stats (clearing logs is
 * analytics-only and never touches transcripts, settings, or tools).
 */

export type AnalyticsTokenSource = "provider" | "estimated" | "none";
export type AnalyticsStatus = "success" | "error";

export interface AnalyticsLog {
  id: string;
  sessionId: string;
  timestamp: number;
  kind: string;
  provider: string;
  providerLabel: string | null;
  model: string;
  agentType: string;
  requestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  tokenSource: AnalyticsTokenSource;
  latencyMs: number | null;
  status: AnalyticsStatus;
  errorCode: string | null;
  errorMessage: string | null;
  costUsd: number | null;
  promptChars: number | null;
  completionChars: number | null;
  toolCalls: number | null;
  toolNames: string[];
  message: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AnalyticsStats {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  providerTokens: number;
  estimatedTokens: number;
  totalCostUsd: number;
  hasCost: boolean;
  avgLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  byProvider: Array<{
    provider: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    errors: number;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    requests: number;
    totalTokens: number;
    errors: number;
  }>;
  byStatus: { success: number; error: number };
  recentActivity: AnalyticsLog[];
}

export interface AnalyticsLogFilter {
  sessionId?: string;
  provider?: string;
  model?: string;
  status?: AnalyticsStatus | "";
  tokenSource?: "provider" | "estimated" | "";
  agentType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchAnalyticsStats(sessionId?: string, provider?: string): Promise<AnalyticsStats> {
  const url =
    routeUrl(API_ROUTES.analyticsStats) +
    queryString({ sessionId, provider });
  const data = await requestJson<{ stats?: AnalyticsStats }>(url);
  if (!data.stats) throw new Error("Analytics stats unavailable.");
  return data.stats;
}

export async function fetchAnalyticsLogs(filter: AnalyticsLogFilter = {}): Promise<AnalyticsLog[]> {
  const url =
    routeUrl(API_ROUTES.analyticsLogs) +
    queryString({
      sessionId: filter.sessionId,
      provider: filter.provider,
      model: filter.model,
      status: filter.status || undefined,
      tokenSource: filter.tokenSource || undefined,
      agentType: filter.agentType,
      search: filter.search,
      limit: filter.limit ?? 100,
      offset: filter.offset ?? 0,
    });
  const data = await requestJson<{ logs?: AnalyticsLog[] }>(url);
  return data.logs ?? [];
}

export async function fetchAnalyticsLog(id: string): Promise<AnalyticsLog> {
  const data = await requestJson<{ log?: AnalyticsLog }>(
    routeUrl(API_ROUTES.analyticsLogGet, { params: { id } }),
  );
  if (!data.log) throw new Error("Log not found.");
  return data.log;
}

export async function fetchAnalyticsProviders(sessionId?: string): Promise<string[]> {
  const url =
    routeUrl(API_ROUTES.analyticsProviders) + queryString({ sessionId });
  const data = await requestJson<{ providers?: string[] }>(url);
  return data.providers ?? [];
}

export async function clearAnalytics(sessionId?: string): Promise<void> {
  const url =
    routeUrl(API_ROUTES.analyticsClear) + queryString({ sessionId });
  await requestJson(url, { method: "DELETE" });
}
