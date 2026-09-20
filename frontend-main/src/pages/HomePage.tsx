import { useCallback } from "react";
import { Rocket, ArrowUpRight } from "lucide-react";
import { Rail } from "@/components/Rail";
import { Composer } from "@/components/Composer";
import { useStore } from "@/store/useStore";
import { greeting } from "@/utils/format";

/** Quick-start prompt suggestions surfaced on the landing page. */
const QUICK_STARTS = [
  "Draft a product narrative",
  "Structure a knowledge base",
  "Brief a sub-agent",
  "Plan a landing page",
  "Summarize a document",
  "Capture this to memory",
];

/**
 * The home / landing page. Shows the shared sidebar, a prominent Quick start action, and
 * the same prompt box used in chat — docked near the top (above the middle). Sending a
 * message mints a brand-new chat session and redirects to /chat/<sessionId>.
 */
export function HomePage({
  onSend,
  onStop,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  // Starting from Home always begins a fresh session: mint a new chat id (which also
  // resets todos and keys a clean backend context), route to it, then send.
  const startAndSend = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      const id = useStore.getState().newConversation();
      useStore.getState().navigate({ name: "chat", sessionId: id });
      onSend(clean);
    },
    [onSend],
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between px-6 max-[640px]:px-4">
          <p className="m-0 text-sm font-medium">Haku</p>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Quick start — connect an AI model"
            aria-label="Quick start"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--secondary)] px-4 text-xs font-medium text-[var(--secondary-fg)] transition-transform hover:brightness-110 active:scale-[0.98]"
          >
            <Rocket className="h-4 w-4" strokeWidth={1.9} />
            Quick start
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-6 pt-[10vh] max-[640px]:px-4 max-[640px]:pt-10">
            <div className="stagger-in flex flex-col items-center text-center">
              <h1 className="font-serif-display m-0 text-5xl text-[var(--fg)] max-[640px]:text-4xl">
                {greeting()}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[var(--muted)]">
                A quiet place to think — ask, remember, or hand work to a sub-agent.
              </p>
            </div>

            {/* The same prompt box used in chat, docked near the top of the page. */}
            <div className="mt-6">
              <Composer onSend={startAndSend} onStop={onStop} showFade={false} />
            </div>

            <div className="mt-2 w-full">
              <p className="m-0 mb-2 px-1 text-center text-xs font-medium uppercase tracking-[0.06em] text-[var(--subtle)]">
                Quick start
              </p>
              <ul className="m-0 flex flex-wrap justify-center gap-2 p-0">
                {QUICK_STARTS.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => startAndSend(p)}
                      className="group inline-flex items-center gap-1.5 rounded-full bg-[var(--chip)] px-4 py-2.5 text-sm text-[var(--fg)] transition-colors hover:bg-[var(--chip-hover)] active:scale-[0.97]"
                    >
                      {p}
                      <ArrowUpRight className="h-3.5 w-3.5 text-[var(--subtle)] transition-colors group-hover:text-[var(--fg)]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
