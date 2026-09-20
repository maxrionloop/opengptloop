import { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { greeting } from "@/utils/format";
import { MessageList } from "./MessageList";

const PROMPTS = [
  "Draft a product narrative",
  "Structure a knowledge base",
  "Brief a sub-agent",
  "Capture this to memory",
];

export function ChatPanel({ onSend }: { onSend: (text: string) => void }) {
  const conversations = useStore((s) => s.conversations);
  const currentId = useStore((s) => s.currentId);

  const messages = useMemo(
    () => conversations.find((c) => c.id === currentId)?.messages ?? [],
    [conversations, currentId],
  );

  if (messages.length > 0) {
    return <MessageList messages={messages} />;
  }

  // Empty session (freshly opened or link-shared with no history yet). The recents list
  // lives in the sidebar's Chat history flyout now — this is just a quiet starting point.
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-6 py-10 text-center max-[640px]:px-4">
        <div className="stagger-in flex w-full max-w-xl flex-col items-center">
          <h1 className="font-serif-display m-0 text-5xl text-[var(--fg)] max-[640px]:text-4xl">
            {greeting()}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[var(--muted)]">
            A quiet place to think — ask, remember, or hand work to a sub-agent.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {PROMPTS.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onSend(p)}
                  className="rounded-full bg-[var(--chip)] px-4 py-2.5 text-sm text-[var(--fg)] transition-colors hover:bg-[var(--chip-hover)] active:scale-[0.97]"
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
