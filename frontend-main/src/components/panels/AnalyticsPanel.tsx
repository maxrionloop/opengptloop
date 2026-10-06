import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  clearAnalytics,
  fetchAnalyticsContext,
  fetchAnalyticsLogs,
  fetchAnalyticsProviders,
  fetchAnalyticsStats,
  type AnalyticsContext,
  type AnalyticsLog,
  type AnalyticsStats,
} from "@/lib/analytics";
import { fetchModels } from "@/lib/api";
import { isCustomProviderId, isLocalProviderId } from "@/lib/providers";
import { Modal } from "@/components/ui/Modal";
import { Button, EmptyState, PanelHeader, Select, TextInput } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";
import { timeAgo } from "@/utils/format";

const POLL_MS = 5_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatLatency(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

function formatCost(usd: number | null, hasCost: boolean): string {
  if (!hasCost || usd == null) return "—";
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Analytics & Logs dashboard (read-only).
 *
 * Shows exactly what the AI agent is doing: which providers/models it uses,
 * how many tokens are consumed, and what errors or performance issues occur.
 * Scope can be the current session, one specific chat session (picked from
 * the session list), or all sessions. Current/specific scopes additionally
 * show the session's LLM context-window usage. Polls the backend while
 * visible — reading never affects the agent's operation.
 */
type Scope = "current" | "specific" | "all";

export function AnalyticsPanel() {
  const currentId = useStore((s) => s.currentId);
  const conversations = useStore((s) => s.conversations);
  const settings = useStore((s) => s.settings);
  const storeModels = useStore((s) => s.models);
  const [scope, setScope] = useState<Scope>("current");
  const [specificId, setSpecificId] = useState<string>("");
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [logs, setLogs] = useState<AnalyticsLog[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [context, setContext] = useState<AnalyticsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  // Resolved model context-window totals, keyed by `${provider}::${model}`.
  // `null` = looked up and unknown; absent = not looked up yet.
  const [windowCache, setWindowCache] = useState<Record<string, number | null>>({});

  // Filters / search
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState<"success" | "error" | "">("");
  const [tokenSource, setTokenSource] = useState<"provider" | "estimated" | "">("");
  const [agentType, setAgentType] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // All known chat sessions, newest first, for the specific-session picker.
  const sessionOptions = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  );

  const sessionId =
    scope === "current" ? (currentId ?? undefined) : scope === "specific" ? (specificId || undefined) : undefined;

  // When entering specific-session mode with nothing picked yet, start from
  // the current session (falling back to the newest known session).
  const enterScope = (next: Scope) => {
    setScope(next);
    if (next === "specific") {
      setSpecificId((prev) => prev || currentId || sessionOptions[0]?.id || "");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const reload = useCallback(async () => {
    try {
      const contextPromise =
        sessionId != null
          ? fetchAnalyticsContext(sessionId).catch(() => null)
          : Promise.resolve(null);
      const [s, list, provs, ctx] = await Promise.all([
        fetchAnalyticsStats(sessionId, provider || undefined),
        fetchAnalyticsLogs({
          sessionId,
          provider: provider || undefined,
          status: status || undefined,
          tokenSource: tokenSource || undefined,
          agentType: agentType || undefined,
          search: debouncedSearch || undefined,
          limit: 100,
        }),
        fetchAnalyticsProviders(sessionId),
        contextPromise,
      ]);
      setStats(s);
      setLogs(list);
      setProviders(provs);
      setContext(ctx);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId, provider, status, tokenSource, agentType, debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    void reload();
    const timer = setInterval(() => {
      void reload();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  // Reset provider filter when the scope/session changes to avoid stale selections.
  useEffect(() => {
    setProvider("");
  }, [scope, sessionId]);

  // Which model the context-window card refers to: the live settings model for
  // the current session; the session's last-used model for a specific session
  // (historical analysis), falling back to the settings model.
  const targetModel =
    scope === "specific" ? (context?.lastModel || settings.model) : settings.model || context?.lastModel || "";
  const targetProvider =
    scope === "specific" ? (context?.lastProvider || settings.provider) : settings.provider;

  // The model's context-window total: prefer the already-loaded catalog, else
  // fetch the provider catalog on demand with the stored API key (cached).
  const storeWindow = useMemo(() => {
    if (!targetModel) return null;
    const match =
      storeModels.find((m) => m.id === targetModel && m.provider === targetProvider) ??
      storeModels.find((m) => m.id === targetModel);
    return typeof match?.context_window === "number" ? match.context_window : null;
  }, [storeModels, targetModel, targetProvider]);
  const windowKey = targetProvider && targetModel ? `${targetProvider}::${targetModel}` : "";
  const cachedWindow = windowKey ? windowCache[windowKey] : undefined;

  useEffect(() => {
    if (!windowKey || storeWindow != null || cachedWindow !== undefined) return;
    if (isCustomProviderId(targetProvider)) return; // manual models — no catalog to query
    const key = settings.apiKeys[targetProvider] ?? "";
    if (!key && !isLocalProviderId(targetProvider)) {
      setWindowCache((c) => (c[windowKey] === null ? c : { ...c, [windowKey]: null }));
      return;
    }
    let cancelled = false;
    fetchModels(targetProvider, key, settings.baseUrl || undefined)
      .then((list) => {
        if (cancelled) return;
        const found = list.find((m) => m.id === targetModel)?.context_window ?? null;
        setWindowCache((c) => ({ ...c, [windowKey]: found }));
      })
      .catch(() => {
        if (!cancelled) setWindowCache((c) => ({ ...c, [windowKey]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [windowKey, storeWindow, cachedWindow, targetProvider, targetModel, settings.apiKeys, settings.baseUrl]);

  const contextWindow = storeWindow ?? cachedWindow ?? null;
  const windowLoading = Boolean(windowKey) && storeWindow == null && cachedWindow === undefined && !isCustomProviderId(targetProvider);

  const selected = useMemo(
    () => logs.find((l) => l.id === selectedId) ?? null,
    [logs, selectedId],
  );

  const successRate =
    stats && stats.totalRequests > 0
      ? Math.round((stats.successCount / stats.totalRequests) * 100)
      : null;

  const handleClear = async () => {
    if (clearing) return;
    const label =
      scope === "current" && currentId
        ? "this session's"
        : scope === "specific" && sessionId
          ? "the selected session's"
          : "all";
    if (!window.confirm(`Clear ${label} analytics logs? This never touches agent chats, settings, or tools.`)) {
      return;
    }
    setClearing(true);
    try {
      await clearAnalytics(sessionId);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl panel-in">
      <div className="flex items-end justify-between gap-3">
        <PanelHeader kicker="Read-only · never affects the agent" title="Analytics" />
        <div className="flex items-center gap-2 pb-2">
          <Button variant="ghost" onClick={() => void reload()} title="Refresh now">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="danger" onClick={() => void handleClear()} disabled={clearing}>
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear
          </Button>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        Exactly what the agent is doing — providers, models, tokens, latency, and errors.
        {scope === "current" && currentId ? (
          <>
            {" "}Showing the <span className="font-medium text-[var(--fg)]">current session</span> logs
            and context window.
          </>
        ) : scope === "specific" && sessionId ? (
          <>
            {" "}Showing logs and context window for{" "}
            <span className="font-medium text-[var(--fg)]">
              {sessionOptions.find((c) => c.id === sessionId)?.title || "the selected session"}
            </span>
            .
          </>
        ) : scope === "specific" ? (
          <> Pick a chat session below to inspect its logs and context window.</>
        ) : (
          <> Showing logs across <span className="font-medium text-[var(--fg)]">all sessions</span>.</>
        )}
      </p>

      {/* Scope picker: current session, one specific session, or all sessions */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--chip)] px-3 py-2.5">
        <div className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1" role="group" aria-label="Analytics scope">
          {(["current", "specific", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => enterScope(s)}
              aria-pressed={scope === s}
              className={cn(
                "rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors",
                scope === s
                  ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
                  : "text-[var(--muted)] hover:text-[var(--fg)]",
              )}
            >
              {s === "current" ? "Current session" : s === "specific" ? "Specific session" : "All sessions"}
            </button>
          ))}
        </div>
        {scope === "current" && currentId && (
          <span className="truncate font-mono text-[10px] text-[var(--subtle)]">{currentId}</span>
        )}
        {scope === "specific" && (
          <Select
            value={specificId}
            onChange={(e) => setSpecificId(e.target.value)}
            className="min-w-0 flex-1"
            aria-label="Pick a chat session"
          >
            <option value="">Pick a chat session…</option>
            {sessionOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {(c.title || "Untitled").slice(0, 60)}{c.id === currentId ? " (current)" : ""}
              </option>
            ))}
          </Select>
        )}
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : stats ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Zap className="h-4 w-4" />} label="Total tokens" value={formatTokens(stats.totalTokens)} sub={`${formatTokens(stats.totalInputTokens)} in · ${formatTokens(stats.totalOutputTokens)} out`} />
            <StatCard icon={<Activity className="h-4 w-4" />} label="Requests" value={String(stats.totalRequests)} sub={successRate != null ? `${successRate}% success` : "No requests yet"} />
            <StatCard icon={<Clock className="h-4 w-4" />} label="Avg latency" value={formatLatency(stats.avgLatencyMs)} sub={stats.minLatencyMs != null ? `min ${formatLatency(stats.minLatencyMs)} · max ${formatLatency(stats.maxLatencyMs)}` : "—"} />
            <StatCard icon={<Coins className="h-4 w-4" />} label="Cost" value={formatCost(stats.totalCostUsd, stats.hasCost)} sub={stats.hasCost ? "provider-reported" : "no provider reported cost"} />
          </div>

          {/* LLM context window for the current / specific session */}
          {sessionId && (
            <ContextWindowCard
              context={context}
              loading={loading && context == null}
              model={targetModel}
              provider={targetProvider}
              windowTotal={contextWindow}
              windowLoading={windowLoading}
            />
          )}

          {/* Success vs failed + token source */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-4" style={{ boxShadow: "var(--shadow-chip)" }}>
              <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Successful vs failed
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" /> {stats.successCount}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">
                  <XCircle className="h-3 w-3" /> {stats.errorCount}
                </span>
              </div>
              {stats.totalRequests > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${successRate ?? 0}%` }} />
                </div>
              )}
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-4" style={{ boxShadow: "var(--shadow-chip)" }}>
              <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                <Cpu className="h-3.5 w-3.5" /> Token source
              </p>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">Provider</span>
                  <span className="font-medium tabular-nums text-[var(--fg)]">{formatTokens(stats.providerTokens)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">Estimated</span>
                  <span className="font-medium tabular-nums text-[var(--fg)]">{formatTokens(stats.estimatedTokens)}</span>
                </div>
              </div>
              <p className="m-0 mt-2 text-[10px] leading-relaxed text-[var(--subtle)]">
                Estimated = built-in counter (provider sent no usage).
              </p>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-4" style={{ boxShadow: "var(--shadow-chip)" }}>
              <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                <BarChart3 className="h-3.5 w-3.5" /> Top provider
              </p>
              {stats.byProvider.length > 0 ? (
                <>
                  <p className="m-0 truncate text-sm font-medium text-[var(--fg)]">{stats.byProvider[0]!.provider}</p>
                  <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">
                    {stats.byProvider[0]!.requests} requests · {formatTokens(stats.byProvider[0]!.totalTokens)} tokens
                  </p>
                </>
              ) : (
                <p className="m-0 text-xs text-[var(--muted)]">No requests yet.</p>
              )}
            </div>
          </div>

          {/* Per-provider breakdown */}
          {stats.byProvider.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
              <p className="m-0 border-b border-[var(--border)] bg-[var(--chip)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">
                Usage by provider
              </p>
              <ul className="m-0 list-none divide-y divide-[var(--border)] p-0">
                {stats.byProvider.slice(0, 10).map((p) => (
                  <li key={p.provider} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--fg)]">{p.provider}</span>
                    <span className="text-[var(--muted)] tabular-nums">{p.requests} req</span>
                    <span className="text-[var(--muted)] tabular-nums">{formatTokens(p.inputTokens)} in</span>
                    <span className="text-[var(--muted)] tabular-nums">{formatTokens(p.outputTokens)} out</span>
                    {p.errors > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-500">
                        <AlertTriangle className="h-3 w-3" /> {p.errors} failed
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Per-model breakdown */}
          {stats.byModel.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
              <p className="m-0 border-b border-[var(--border)] bg-[var(--chip)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">
                Top models
              </p>
              <ul className="m-0 list-none divide-y divide-[var(--border)] p-0">
                {stats.byModel.slice(0, 8).map((m) => (
                  <li key={`${m.provider}::${m.model}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--fg)]" title={`${m.provider} · ${m.model}`}>
                      {m.model} <span className="font-normal text-[var(--subtle)]">· {m.provider}</span>
                    </span>
                    <span className="text-[var(--muted)] tabular-nums">{m.requests} req</span>
                    <span className="text-[var(--muted)] tabular-nums">{formatTokens(m.totalTokens)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : null}

      {/* Filters + search */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--subtle)]" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, provider, error…"
            className="pl-9"
          />
        </div>
        <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-auto" aria-label="Filter by provider">
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as "" | "success" | "error")} className="w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Failed</option>
        </Select>
        <Select value={tokenSource} onChange={(e) => setTokenSource(e.target.value as "" | "provider" | "estimated")} className="w-auto" aria-label="Filter by token source">
          <option value="">All token sources</option>
          <option value="provider">Provider-counted</option>
          <option value="estimated">Estimated (built-in)</option>
        </Select>
        <Select value={agentType} onChange={(e) => setAgentType(e.target.value)} className="w-auto" aria-label="Filter by agent">
          <option value="">All agents</option>
          <option value="main">Main</option>
          <option value="chat">Chat</option>
          <option value="subagent">Sub-agent</option>
          <option value="team">Team</option>
          <option value="ceo">CEO</option>
          <option value="memory">Memory</option>
          <option value="custom">Custom</option>
          <option value="channel">Channel</option>
          <option value="schedule">Schedule</option>
        </Select>
      </div>

      {/* Logs */}
      <div className="mt-3">
        <p className="m-0 mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">
          Logs · {logs.length} shown · click a row for full metadata
        </p>
        {logs.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-8 w-8" />}>
            No AI requests logged yet{sessionId ? " in this session" : ""}. Send a chat message and
            usage, latency, and errors will appear here automatically.
          </EmptyState>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0">
            {logs.map((log) => (
              <li key={log.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(log.id)}
                  className="flex w-full flex-col gap-1.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-3.5 text-left transition-colors hover:border-[var(--secondary)]"
                  style={{ boxShadow: "var(--shadow-chip)" }}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={log.status} />
                    <TokenSourceBadge source={log.tokenSource} />
                    <span className="truncate text-xs font-medium text-[var(--fg)]">
                      {log.model}
                      <span className="font-normal text-[var(--subtle)]"> · {log.provider}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--subtle)]">
                      {timeAgo(log.timestamp)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--muted)]">
                    <span className="tabular-nums">
                      {(log.inputTokens ?? 0).toLocaleString()} in · {(log.outputTokens ?? 0).toLocaleString()} out · {formatTokens(log.totalTokens ?? 0)} total
                    </span>
                    <span className="tabular-nums">{formatLatency(log.latencyMs)}</span>
                    <span className="rounded-full border border-[var(--border)] px-1.5 py-0.5">{log.agentType}</span>
                    {log.toolCalls != null && log.toolCalls > 0 && (
                      <span>{log.toolCalls} tool call{log.toolCalls === 1 ? "" : "s"}</span>
                    )}
                    {log.costUsd != null && (
                      <span className="tabular-nums">${log.costUsd.toFixed(5)}</span>
                    )}
                  </div>
                  {log.status === "error" && log.errorMessage && (
                    <p className="m-0 truncate text-[11px] text-[var(--danger)]">{log.errorMessage}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>}

      {selected && (
        <LogDetailModal log={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-4" style={{ boxShadow: "var(--shadow-chip)" }}>
      <p className="m-0 mb-1 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
        {icon} {label}
      </p>
      <p className="m-0 text-2xl font-semibold tabular-nums text-[var(--fg)]">{value}</p>
      <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--subtle)]" title={sub}>{sub}</p>
    </div>
  );
}

/**
 * LLM context-window card: how much of the model's context window the
 * session's conversation currently occupies.
 *
 * - `used` is the last logged prompt size for the session (the provider's
 *   ACTUAL input count when it reported usage, else the built-in estimate —
 *   both include system prompt + tools), falling back to the transcript
 *   estimate when no call was logged yet.
 * - `windowTotal` is the model's advertised context window; when the catalog
 *   has no entry for the model the card still shows usage with an "unknown
 *   window" note instead of failing.
 */
function ContextWindowCard({
  context,
  loading,
  model,
  provider,
  windowTotal,
  windowLoading,
}: {
  context: AnalyticsContext | null;
  loading: boolean;
  model: string;
  provider: string;
  windowTotal: number | null;
  windowLoading: boolean;
}) {
  return (
    <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-4" style={{ boxShadow: "var(--shadow-chip)" }}>
      <p className="m-0 mb-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
        <Gauge className="h-3.5 w-3.5" /> LLM context window
        {model && (
          <span className="truncate font-mono font-normal normal-case tracking-normal text-[var(--subtle)]" title={`${provider} · ${model}`}>
            {model} · {provider}
          </span>
        )}
        {context?.live && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            live transcript
          </span>
        )}
      </p>

      {loading && !context ? (
        <div className="flex items-center gap-2 py-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Measuring context…
        </div>
      ) : !context || (context.messageCount === 0 && context.usedTokens === 0) ? (
        <p className="m-0 text-xs text-[var(--muted)]">
          No conversation context yet — send a message and the used window appears here.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="m-0 text-2xl font-semibold tabular-nums text-[var(--fg)]">
              {formatTokens(context.usedTokens)}
            </p>
            <p className="m-0 text-sm tabular-nums text-[var(--muted)]">
              {windowTotal != null ? `/ ${formatTokens(windowTotal)} tokens` : "tokens used"}
            </p>
            {windowTotal != null && (
              <p className="m-0 ml-auto text-sm font-medium tabular-nums text-[var(--fg)]">
                {Math.min(100, Math.round((context.usedTokens / windowTotal) * 100))}% used
              </p>
            )}
          </div>

          {windowTotal != null ? (
            <>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
                <div
                  className={cn(
                    "h-full rounded-full",
                    context.usedTokens / windowTotal >= 0.9
                      ? "bg-red-500"
                      : context.usedTokens / windowTotal >= 0.7
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.min(100, (context.usedTokens / windowTotal) * 100)}%` }}
                />
              </div>
              <p className="m-0 mt-1.5 text-[11px] tabular-nums text-[var(--subtle)]">
                {formatTokens(Math.max(0, windowTotal - context.usedTokens))} remaining
              </p>
            </>
          ) : (
            <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[var(--subtle)]">
              {windowLoading
                ? "Looking up this model's context window…"
                : "Context-window size unknown for this model — usage above is still accurate."}
            </p>
          )}

          <p className="m-0 mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
            {context.messageCount} message{context.messageCount === 1 ? "" : "s"}
            {` (${context.userMessages} user · ${context.assistantMessages} assistant · ${context.toolMessages} tool)`}
            {" · "}
            {context.usedSource === "provider"
              ? "last prompt: provider-counted actual"
              : context.usedSource === "estimated"
                ? "last prompt: built-in estimate (provider sent no usage)"
                : "transcript estimate (no calls logged yet)"}
            {context.live ? " · measured live" : " · from saved transcript"}
          </p>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "success" | "error" }) {
  return status === "success" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> Success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-500">
      <XCircle className="h-3 w-3" /> Failed
    </span>
  );
}

function TokenSourceBadge({ source }: { source: "provider" | "estimated" | "none" }) {
  if (source === "provider") {
    return (
      <span title="Token counts reported by the provider/API" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
        Provider-counted
      </span>
    );
  }
  if (source === "estimated") {
    return (
      <span title="Provider sent no usage — counted by the app's built-in token counter (estimate)" className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600">
        Estimated (built-in)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--chip)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
      No tokens
    </span>
  );
}

/** Detailed log viewer: every available metadata field for one log. */
function LogDetailModal({ log, onClose }: { log: AnalyticsLog; onClose: () => void }) {
  const rows: Array<[string, string]> = [
    ["Log id", log.id],
    ["Session", log.sessionId],
    ["Timestamp", `${formatTime(log.timestamp)} (${timeAgo(log.timestamp)})`],
    ["Kind", log.kind],
    ["Provider", log.providerLabel ? `${log.provider} (${log.providerLabel})` : log.provider],
    ["Model", log.model],
    ["Agent", log.agentType],
    ["Request/response id", log.requestId ?? "— (provider did not return one)"],
    ["Input tokens", log.inputTokens != null ? log.inputTokens.toLocaleString() : "—"],
    ["Output tokens", log.outputTokens != null ? log.outputTokens.toLocaleString() : "—"],
    ["Total tokens", log.totalTokens != null ? log.totalTokens.toLocaleString() : "—"],
    [
      "Token source",
      log.tokenSource === "provider"
        ? "Provider-counted (actual usage from the API)"
        : log.tokenSource === "estimated"
          ? "Estimated (built-in app counter — provider sent no usage)"
          : "None",
    ],
    ["Latency", formatLatency(log.latencyMs)],
    ["Status", log.status],
    ["Error code", log.errorCode ?? "—"],
    ["Error", log.errorMessage ?? "—"],
    ["Cost (USD)", log.costUsd != null ? `$${log.costUsd}` : "— (provider did not report cost)"],
    ["Prompt chars", log.promptChars != null ? log.promptChars.toLocaleString() : "—"],
    ["Completion chars", log.completionChars != null ? log.completionChars.toLocaleString() : "—"],
    ["Tool calls", log.toolCalls != null ? String(log.toolCalls) : "—"],
    ["Tools used", log.toolNames.length > 0 ? log.toolNames.join(", ") : "—"],
    ["Message", log.message ?? "—"],
  ];
  return (
    <Modal open onClose={onClose} title={`Log · ${log.model}`} size="lg" align="top">
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={log.status} />
          <TokenSourceBadge source={log.tokenSource} />
        </div>
        <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">{label}</dt>
              <dd className="m-0 mt-0.5 break-words text-xs text-[var(--fg)]">{value}</dd>
            </div>
          ))}
        </dl>
        {log.metadata && (
          <div>
            <p className="m-0 mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--subtle)]">
              Extra metadata (JSON)
            </p>
            <pre className={cn("m-0 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-3 font-mono text-[11px] leading-relaxed text-[var(--fg)]")}>
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
