import { useEffect, useState } from "react";
import { FileText, Gauge } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/utils/cn";
import {
  contextPercent,
  formatTokenCompact,
  formatTokenCount,
} from "@/lib/contextMeter";
import { RawContextModal } from "@/components/chat/RawContextModal";

/**
 * Main-agent context meter: a header button + popup showing the current conversation's
 * context-token usage from the `context_usage` log events in the turn's event stream.
 *
 * Data flow (existing logging pipeline, no polling): the backend's main-agent loop emits
 * one `context_usage` event per LLM request (prompt_tokens = current context size) onto
 * the SessionEventBuffer → SQLite stream_events → SSE. `streamDispatch` validates and
 * stores the latest per conversation; this component subscribes to that store slice, so
 * the popup refreshes through the normal agent-update lifecycle (live + replay).
 *
 * Scope: rendered only for the built-in Main Agent (see `isMainAgentActive` in TopBar).
 * Subagents, Custom Agents, teams, CEO agents, and chat mode never mount this component,
 * and their log events are ignored by the normalizer — their behavior is untouched.
 */
export function ContextMeter() {
  const [open, setOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const currentId = useStore((s) => s.currentId);

  // Close on Escape (the overlay click also closes). No subscriptions here beyond the
  // store selectors below — opening/closing mounts/unmounts the popup with no extra
  // listeners, timers, or fetches, so repeated toggling cannot leak or duplicate work.
  // While the raw-context modal is open it owns Escape (it is a portal above this
  // popup), so this listener stands down to avoid closing both layers at once.
  useEffect(() => {
    if (!open || rawOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rawOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Main agent context usage"
        aria-label="Main agent context usage"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "relative grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]",
        )}
      >
        <Gauge className="h-[18px] w-[18px]" strokeWidth={1.7} />
        <MeterDot />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Main agent context usage"
            className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] pop-in"
            style={{ boxShadow: "var(--shadow-pop)" }}
          >
            <ContextMeterBody
              currentId={currentId}
              onViewRaw={() => setRawOpen(true)}
            />
          </div>
        </>
      )}

      <RawContextModal
        open={rawOpen}
        onClose={() => setRawOpen(false)}
        sessionId={currentId}
        agent="main"
      />
    </div>
  );
}

/**
 * Small status dot on the button reflecting the latest known utilization. Subscribes to
 * the same store slice as the popup (no extra work). Hidden while no usage is known.
 */
function MeterDot() {
  const currentId = useStore((s) => s.currentId);
  const usage = useStore((s) => (currentId ? s.contextUsage[currentId] : undefined));
  const models = useStore((s) => s.models);
  const settings = useStore((s) => s.settings);

  if (!usage) return null;
  const limit = limitFor(models, settings.provider, settings.model);
  const pct = contextPercent(usage.promptTokens, limit);
  if (pct === null) return null;
  const tone =
    pct >= 90
      ? "bg-[var(--danger)]"
      : pct >= 70
        ? "bg-[var(--warning)]"
        : "bg-[var(--secondary)]";
  return (
    <span
      aria-hidden
      title={`${pct}% of context used`}
      className={cn(
        "absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-semibold tabular-nums text-[var(--secondary-fg)]",
        tone,
      )}
    >
      {pct >= 99.5 ? "!" : formatTokenCompact(usage.promptTokens)}
    </span>
  );
}

function ContextMeterBody({
  currentId,
  onViewRaw,
}: {
  currentId: string | null;
  onViewRaw: () => void;
}) {
  const usage = useStore((s) => (currentId ? s.contextUsage[currentId] : undefined));
  const streaming = useStore((s) => s.streaming);
  const models = useStore((s) => s.models);
  const modelsLoading = useStore((s) => s.modelsLoading);
  const settings = useStore((s) => s.settings);
  // Stub conversations (loaded === false) are still fetching their snapshot + logged
  // usage from the database — show a loading state, not the empty state.
  const loading = useStore((s) =>
    currentId ? s.conversations.find((c) => c.id === currentId)?.loaded === false : false,
  );

  const limit = limitFor(models, settings.provider, settings.model);
  const modelLabel = usage?.model || settings.model || "current model";

  // No log data for this conversation yet: unavailable (not zero). The meter fills in
  // once the main agent's first `context_usage` event arrives via the stream, or the
  // stored log entry loads from the database after a refresh/reopen.
  if (!usage) {
    return (
      <div className="px-4 py-4">
        <PopupTitle modelLabel={modelLabel} />
        <p className="m-0 mt-2 text-xs leading-relaxed text-[var(--muted)]">
          {loading
            ? "Loading context data from this thread's logs…"
            : streaming
              ? "Waiting for the main agent's first usage report…"
              : "No context data yet — it appears after the main agent's next reply."}
        </p>
        <p className="m-0 mt-2 text-[11px] leading-relaxed text-[var(--subtle)]">
          Usage comes from the main agent's request logs. Providers that stay silent report
          nothing rather than an estimate.
        </p>
        <ViewRawContextButton onViewRaw={onViewRaw} disabled={!currentId} />
      </div>
    );
  }

  const pct = contextPercent(usage.promptTokens, limit);

  return (
    <div className="px-4 py-4">
      <PopupTitle modelLabel={modelLabel} />

      <p className="m-0 mt-2 text-2xl font-semibold tabular-nums text-[var(--fg)]">
        {formatTokenCount(usage.promptTokens)}{" "}
        <span className="text-sm font-normal text-[var(--muted)]">tokens</span>
      </p>

      {pct !== null && limit != null ? (
        <>
          <p className="m-0 mt-1 text-xs tabular-nums text-[var(--muted)]">
            of {formatTokenCount(limit)} ({pct}%)
          </p>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Context window used"
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--chip)]"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                pct >= 90 ? "bg-[var(--danger)]" : pct >= 70 ? "bg-[var(--warning)]" : "bg-[var(--secondary)]",
              )}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </>
      ) : (
        <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--subtle)]">
          {modelsLoading
            ? "Loading the model's context limit…"
            : "Context limit unknown for this model — showing tokens only."}
        </p>
      )}

      <dl className="m-0 mt-3 flex flex-col gap-1 border-t border-[var(--border)] pt-3 text-xs">
        {usage.completionTokens !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--subtle)]">Completion (last request)</dt>
            <dd className="m-0 tabular-nums text-[var(--muted)]">
              {formatTokenCount(usage.completionTokens)}
            </dd>
          </div>
        )}
        {usage.totalTokens !== undefined && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--subtle)]">Total (last request)</dt>
            <dd className="m-0 tabular-nums text-[var(--muted)]">
              {formatTokenCount(usage.totalTokens)}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--subtle)]">Scope</dt>
          <dd className="m-0 text-[var(--muted)]">Main agent · this thread</dd>
        </div>
      </dl>

      <p className="m-0 mt-3 text-[10px] leading-relaxed text-[var(--subtle)]">
        Current context size of the latest request — not a lifetime total. Updates with each
        main-agent reply.
      </p>

      <ViewRawContextButton onViewRaw={onViewRaw} disabled={!currentId} />
    </div>
  );
}

/**
 * Entry point to the raw-context viewer. Rendered in both popup states (usage known
 * or not) so the transcript + system prompt stay inspectable even before the first
 * usage report. Main Agent only — the parent meter never mounts for other agents.
 */
function ViewRawContextButton({
  onViewRaw,
  disabled,
}: {
  onViewRaw: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onViewRaw}
      disabled={disabled}
      title="View the main agent's current context in raw format"
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--chip)] px-3 py-2 text-xs font-medium text-[var(--fg)] transition-colors hover:bg-[var(--chip-hover)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <FileText className="h-3.5 w-3.5" strokeWidth={1.8} />
      View raw context
    </button>
  );
}

function PopupTitle({ modelLabel }: { modelLabel: string }) {
  return (
    <div className="flex items-center gap-2">
      <Gauge className="h-4 w-4 shrink-0 text-[var(--secondary)]" strokeWidth={1.8} />
      <h2 className="m-0 truncate text-sm font-semibold text-[var(--fg)]">Context usage</h2>
      {modelLabel.trim().length > 0 && (
        <span className="ml-auto max-w-[10rem] truncate rounded-full bg-[var(--chip)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
          {modelLabel}
        </span>
      )}
    </div>
  );
}

/** Resolve the context-window limit for the active provider+model from the models catalog. */
function limitFor(
  models: Array<{ provider: string; id: string; context_window?: number | null }>,
  provider: string,
  model: string,
): number | null {
  const id = model.trim();
  if (!id) return null;
  const match =
    models.find((m) => m.provider === provider && m.id === id) ??
    models.find((m) => m.id === id);
  const limit = match?.context_window;
  return typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null;
}
