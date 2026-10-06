import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { fetchAnalyticsContext, type AnalyticsContext } from "@/lib/analytics";
import {
  contextLimitKey,
  formatContextTokens,
  resolveContextLimit,
} from "@/lib/contextLimits";
import { cn } from "@/utils/cn";

const POLL_MS = 5_000;

/**
 * Context meter — the small circle in the prompt box, just beside the task
 * mode picker. Shows the current LLM context usage as a percentage ("%").
 * Clicking it opens a read-only popup with the available context tokens.
 *
 * Data sources (both already fetched by the app — nothing new invented):
 * - Used tokens: GET /api/analytics/context?sessionId= (provider-counted
 *   actual when the provider reported usage, else the built-in estimate,
 *   else the live transcript estimate).
 * - Total window: the provider `/models` catalog `context_window`, falling
 *   back to the user's confirmed manual limit (Settings → 250k default).
 * Display-only: editing a limit happens only in Settings, never here.
 */
export function ContextMeter() {
  const currentId = useStore((s) => s.currentId);
  const settings = useStore((s) => s.settings);
  const models = useStore((s) => s.models);
  const customProviders = useStore((s) => s.customProviders);
  const streaming = useStore((s) => s.streaming);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const messageCount = useStore((s) =>
    s.conversations.find((c) => c.id === s.currentId)?.messages.length ?? 0,
  );

  const [context, setContext] = useState<AnalyticsContext | null>(null);
  const [open, setOpen] = useState(false);

  const providerId = settings.provider ?? "";
  const modelId = settings.model ?? "";
  const manualLimitsRef = settings.manualContextLimits;

  const { limit, source: limitSource } = useMemo(
    () =>
      resolveContextLimit({
        providerId,
        modelId,
        models,
        customProviders,
        manualLimits: manualLimitsRef ?? {},
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providerId, modelId, models, customProviders, manualLimitsRef],
  );

  useEffect(() => {
    if (!currentId) {
      setContext(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const ctx = await fetchAnalyticsContext(currentId);
        if (!cancelled) setContext(ctx);
      } catch {
        // Keep the last known figure; the meter degrades to the transcript
        // estimate rather than failing the whole prompt box.
        if (!cancelled) setContext((prev) => (prev?.sessionId === currentId ? prev : null));
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentId, streaming, messageCount]);

  const used = context?.usedTokens ?? 0;
  const percent =
    limit != null && limit > 0 ? Math.min(100, Math.max(0, Math.round((used / limit) * 100))) : null;
  const remaining = limit != null ? Math.max(0, limit - used) : null;

  const ringColor =
    percent == null
      ? "var(--subtle)"
      : percent >= 90
        ? "#ef4444"
        : percent >= 70
          ? "#f59e0b"
          : "var(--secondary)";

  const label =
    percent == null ? "?" : `${percent}%`;
  const tooltip =
    !modelId
      ? "Pick a model in Settings to measure context"
      : limit == null
        ? `Context used: ${used.toLocaleString()} tokens — window unknown, set it in Settings`
        : `LLM context: ${percent}% used (${used.toLocaleString()} / ${limit.toLocaleString()})`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={tooltip}
        aria-label="LLM context usage"
        aria-expanded={open}
        className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]"
      >
        <span className="relative grid h-8 w-8 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute inset-0 h-8 w-8 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="var(--border)"
              strokeWidth="3.5"
            />
            {percent != null && (
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke={ringColor}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(percent / 100) * 97.4} 97.4`}
              />
            )}
          </svg>
          <span
            className="font-semibold tabular-nums"
            style={{ fontSize: percent != null && percent === 100 ? 9 : 10, color: "var(--fg)" }}
          >
            {label}
          </span>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute bottom-12 left-0 z-50 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] pop-in"
            style={{ boxShadow: "var(--shadow-pop)" }}
            role="dialog"
            aria-label="Current LLM context"
          >
            <div className="border-b border-[var(--border)] px-3.5 py-2.5">
              <p className="m-0 text-xs font-semibold text-[var(--fg)]">Current LLM context</p>
              <p className="m-0 mt-0.5 truncate font-mono text-[10px] text-[var(--subtle)]" title={`${providerId} · ${modelId}`}>
                {modelId ? `${modelId} · ${providerId}` : "No model selected"}
              </p>
            </div>

            <div className="space-y-2.5 px-3.5 py-3">
              {limit != null ? (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="m-0 text-xl font-semibold tabular-nums text-[var(--fg)]">
                      {percent}% <span className="text-xs font-normal text-[var(--muted)]">used</span>
                    </p>
                    <p className="m-0 text-[11px] tabular-nums text-[var(--muted)]">
                      {formatContextTokens(used)} / {formatContextTokens(limit)}
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
                    <div
                      className={cn("h-full rounded-full")}
                      style={{
                        width: `${percent ?? 0}%`,
                        background: ringColor,
                      }}
                    />
                  </div>
                  <dl className="m-0 grid gap-1 text-[11px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--muted)]">Available</dt>
                      <dd className="m-0 font-medium tabular-nums text-[var(--fg)]">
                        {remaining != null ? `${formatContextTokens(remaining)} tokens` : "—"}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--muted)]">Window</dt>
                      <dd className="m-0 font-medium tabular-nums text-[var(--fg)]">
                        {limit.toLocaleString()} tokens
                        {limitSource === "manual" ? " · manual" : " · provider"}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--muted)]">Counted by</dt>
                      <dd className="m-0 text-right font-medium text-[var(--fg)]">
                        {context?.usedSource === "provider"
                          ? "Provider actual"
                          : context?.usedSource === "estimated"
                            ? "Built-in estimate"
                            : context?.usedSource === "transcript"
                              ? "Transcript estimate"
                              : "—"}
                      </dd>
                    </div>
                  </dl>
                  {context && (context.messageCount > 0 || context.usedTokens > 0) && (
                    <p className="m-0 text-[10px] leading-relaxed text-[var(--subtle)]">
                      {context.messageCount} message{context.messageCount === 1 ? "" : "s"}
                      {` (${context.userMessages} user · ${context.assistantMessages} assistant · ${context.toolMessages} tool)`}
                      {context.live ? " · live" : ""}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="m-0 text-xl font-semibold tabular-nums text-[var(--fg)]">
                    {formatContextTokens(used)} <span className="text-xs font-normal text-[var(--muted)]">tokens used</span>
                  </p>
                  <p className="m-0 text-[11px] leading-relaxed text-[var(--muted)]">
                    {modelId
                      ? "This model publishes no context-window size, and no manual limit is confirmed yet — the percentage needs a window."
                      : "Pick a model in Settings to measure the context window."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="w-full rounded-[var(--radius-md)] bg-[var(--secondary)] px-3 py-1.5 text-xs font-medium text-[var(--secondary-fg)]"
                  >
                    Set limit in Settings
                  </button>
                </>
              )}

              <p className="m-0 border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--subtle)]">
                Showing the current LLM context only.
                {limitSource === "manual" && limit != null && (
                  <>
                    {" "}Manual window {formatContextTokens(limit)} ({contextLimitKey(providerId, modelId)}).
                  </>
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
