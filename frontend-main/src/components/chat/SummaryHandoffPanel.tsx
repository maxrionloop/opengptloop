import { useState } from "react";
import { ChevronDown, FileText, History, Loader2, RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useStore } from "@/store/useStore";
import { cn } from "@/utils/cn";
import { fetchSummaryHistory } from "@/lib/summaries";
import type { SummaryHandoffInfo, SummaryHandoffStatus } from "@/types";

/** Stable empty history — keeps the store selector referentially stable (no new array per render). */
const EMPTY_HISTORY: SummaryHandoffInfo[] = [];

function statusLabel(status: SummaryHandoffStatus): string {
  switch (status) {
    case "idle":
      return "Idle";
    case "pausing":
      return "Pausing main agent…";
    case "paused":
      return "Main agent paused";
    case "summarizing":
      return "Summarizing…";
    case "validated":
      return "Summary validated";
    case "replaced":
      return "Context replaced";
    case "resumed":
      return "Main agent resumed";
    case "failed":
      return "Summarization failed";
    case "incomplete":
      return "Summary incomplete";
    case "recovery":
      return "Recovery required";
    default:
      return status;
  }
}

function StatusPill({ status }: { status: SummaryHandoffStatus }) {
  const tone =
    status === "resumed"
      ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
      : status === "failed" || status === "incomplete" || status === "recovery"
        ? "bg-[var(--danger-soft)] text-[var(--danger)]"
        : status === "validated" || status === "replaced"
          ? "bg-[var(--chip)] text-[var(--fg)]"
          : "bg-[var(--chip)] text-[var(--muted)]";
  const spinning = status === "pausing" || status === "paused" || status === "summarizing";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {spinning && <Loader2 className="h-3 w-3 animate-spin" />}
      {statusLabel(status)}
    </span>
  );
}

/**
 * Summary execution popup: header button opens this modal. Shows authoritative
 * backend status (pausing/paused/summarizing/validating/replacing/resuming),
 * live-streamed summary output, the final validated summary, errors and
 * recoverable states, and confirmation that the main agent resumes only after
 * validation + replacement. Closing never cancels the backend job.
 *
 * The history button lists every past summarization run in this session
 * (multiple handoffs are expected as context refills): latest run first, each
 * with its validated summary, status, and timestamps.
 */
export function SummaryHandoffPanel() {
  const open = useStore((s) => s.summaryHandoffOpen);
  const setOpen = useStore((s) => s.setSummaryHandoffOpen);
  const currentId = useStore((s) => s.currentId);
  const handoff = useStore((s) => (currentId ? s.summaryHandoffs[currentId] : undefined));
  const history = useStore((s) => (currentId ? s.summaryHistory[currentId] : undefined)) ?? EMPTY_HISTORY;
  const setSummaryHistory = useStore((s) => s.setSummaryHistory);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Past runs load on explicit button press (never automatically in an effect),
  // merged with live entries already accumulated from the SSE stream.
  async function toggleHistory(): Promise<void> {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (!next || !currentId) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await fetchSummaryHistory(currentId);
      const live = useStore.getState().summaryHistory[currentId] ?? [];
      const byId = new Map<string, (typeof live)[number]>();
      for (const item of items) {
        byId.set(item.handoff_id, {
          handoffId: item.handoff_id,
          status:
            item.state === "RESUMED"
              ? "resumed"
              : item.state === "CONTEXT_REPLACED"
                ? "replaced"
                : item.state === "SUMMARY_VALIDATED"
                  ? "validated"
                  : item.state === "SUMMARY_INCOMPLETE"
                    ? "incomplete"
                    : item.state === "CANCELLED" || item.state === "SUMMARY_FAILED" || item.state === "HANDOFF_FAILED"
                      ? "failed"
                      : "summarizing",
          streamingText: "",
          finalSummary: item.summary,
          summaryChars: item.summary_chars,
          error: item.error,
          code: item.code,
          updatedAt: item.finished_at,
        });
      }
      for (const entry of live) byId.set(entry.handoffId, entry);
      const merged = [...byId.values()].sort((a, b) => a.updatedAt - b.updatedAt);
      setSummaryHistory(currentId, merged);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setHistoryLoading(false);
    }
  }

  const status: SummaryHandoffStatus = handoff?.status ?? "idle";
  const streaming = status === "pausing" || status === "paused" || status === "summarizing";
  const success = status === "resumed";
  const failed = status === "failed" || status === "incomplete" || status === "recovery";
  const orderedHistory = [...history].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Context summary"
      icon={<RefreshCcw className="h-4 w-4" strokeWidth={1.8} />}
      size="lg"
      align="top"
      actions={
        <button
          type="button"
          onClick={() => void toggleHistory()}
          title={historyOpen ? "Hide past runs" : "Show past runs in this session"}
          aria-expanded={historyOpen}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]"
        >
          <History className="h-4 w-4" strokeWidth={1.8} />
          Past runs{history.length > 0 ? ` (${history.length})` : ""}
        </button>
      }
    >
      {!handoff && history.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-[var(--muted)]">
          No summarization run yet for this thread. When the main agent reaches 90% context usage it
          pauses automatically, summarizes, replaces its context, and resumes — as many times as needed.
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          {handoff && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <StatusPill status={status} />
                <span className="font-mono">{handoff.handoffId}</span>
              </div>

              {streaming && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-3">
                  <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Summary-agent output (live)
                  </p>
                  <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)]">
                    {handoff.streamingText || "Waiting for the summary agent's first output…"}
                  </p>
                </div>
              )}

              {handoff.finalSummary && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                  <p className="m-0 mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--secondary)]" />
                    Final validated summary
                  </p>
                  <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)]">
                    {handoff.finalSummary}
                  </p>
                  {handoff.summaryChars != null && (
                    <p className="m-0 mt-2 text-[11px] tabular-nums text-[var(--subtle)]">
                      {handoff.summaryChars.toLocaleString("en-US")} chars
                    </p>
                  )}
                </div>
              )}

              {success && (
                <p className="m-0 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--secondary)]" />
                  Main agent resumed only after the summary was validated and context replacement succeeded.
                </p>
              )}

              {failed && (
                <div className="rounded-[var(--radius-md)] border border-[color:color-mix(in_oklab,var(--danger)_35%,transparent)] bg-[var(--danger-soft)] p-3">
                  <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    {status === "incomplete" ? "Summary incomplete — original context preserved." : "Summarization failed — original context preserved."}
                  </p>
                  {handoff.error && (
                    <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--danger)]">{handoff.error}</p>
                  )}
                  {handoff.code && (
                    <p className="m-0 mt-1 font-mono text-[11px] text-[var(--danger)]">{handoff.code}</p>
                  )}
                </div>
              )}
            </>
          )}

          {historyOpen && (
            <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
              <p className="m-0 border-b border-[var(--border)] px-3 py-2.5 text-xs font-medium text-[var(--muted)]">
                Past runs in this session{historyLoading ? " (loading…)" : ` (${history.length})`}
              </p>
              {historyError && (
                <p className="m-0 px-3 py-2 text-xs text-[var(--danger)]">{historyError}</p>
              )}
              {orderedHistory.length === 0 && !historyLoading ? (
                <p className="m-0 px-3 py-3 text-xs text-[var(--subtle)]">
                  No past runs yet — completed handoffs appear here with their validated summaries.
                </p>
              ) : (
                <ul className="m-0 flex max-h-72 list-none flex-col gap-2 overflow-y-auto p-3">
                  {orderedHistory.map((entry) => (
                    <li
                      key={entry.handoffId}
                      className="rounded-[var(--radius-md)] bg-[var(--chip)] p-2.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={entry.status} />
                        <span className="font-mono text-[11px] text-[var(--subtle)]">
                          {entry.handoffId}
                        </span>
                        <span className="ml-auto text-[11px] tabular-nums text-[var(--subtle)]">
                          {new Date(entry.updatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {entry.finalSummary && (
                        <p className="m-0 mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-[var(--fg)]">
                          {entry.finalSummary}
                        </p>
                      )}
                      {entry.error && (
                        <p className="m-0 mt-1.5 text-xs text-[var(--danger)]">{entry.error}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="rounded-[var(--radius-md)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Execution details
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", detailsOpen && "rotate-180")} />
            </button>
            {detailsOpen && (
              <div className="border-t border-[var(--border)] px-3 py-2.5 text-xs leading-relaxed text-[var(--muted)]">
                <p className="m-0">
                  Status transitions reflect authoritative backend state. A successful completion
                  indicator appears only after validation, context replacement, and resumption — never
                  merely because streaming stopped. The agent may summarize multiple times per session
                  as context refills.
                </p>
                <p className="m-0 mt-2">
                  The summary agent receives only chat data, tool calls/results, and the latest user
                  input. System prompts, memory, knowledge, and hidden reasoning are never sent.
                </p>
                {handoff && (
                  <p className="m-0 mt-2 font-mono text-[11px] text-[var(--subtle)]">
                    handoff {handoff.handoffId} · updated {new Date(handoff.updatedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
