import { useMemo } from "react";
import { MessageSquare, Trash2, Plus, X, History } from "lucide-react";
import { useStore } from "@/store/useStore";
import { DEFAULT_PROFILE_ID } from "@/lib/userProfiles";
import { timeAgo } from "@/utils/format";

/**
 * The sidebar chat-history flyout. Opens from the rail's "Chat history" button and lists
 * every chat session for the active profile (newest first). Selecting one navigates to
 * /chat/<sessionId>; the plus button starts a new chat (which lands on Home).
 */
export function ChatHistory() {
  const open = useStore((s) => s.historyOpen);
  const setHistoryOpen = useStore((s) => s.setHistoryOpen);
  const conversations = useStore((s) => s.conversations);
  const currentId = useStore((s) => s.currentId);
  const activeUserProfileId = useStore((s) => s.activeUserProfileId);
  const openConversationById = useStore((s) => s.openConversationById);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const newChat = useStore((s) => s.newChat);

  const sessions = useMemo(
    () =>
      conversations
        // Profiles are strictly isolated — only show the active profile's chats.
        .filter(
          (c) => (c.profileId ?? DEFAULT_PROFILE_ID) === (activeUserProfileId ?? DEFAULT_PROFILE_ID),
        )
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, activeUserProfileId],
  );

  if (!open) return null;

  return (
    <>
      {/* Click-away backdrop. */}
      <div
        className="fixed inset-0 z-40"
        onClick={() => setHistoryOpen(false)}
        aria-hidden
      />

      <aside
        className="fixed inset-y-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-[var(--border)] bg-[var(--bg)] pop-in max-[640px]:w-72"
        style={{ left: "var(--rail-w)", boxShadow: "var(--shadow-pop)" }}
        role="dialog"
        aria-label="Chat history"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.8} />
            <p className="m-0 text-sm font-medium text-[var(--fg)]">Chat history</p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(false)}
            title="Close"
            aria-label="Close chat history"
            className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => newChat()}
            className="flex w-full items-center gap-2 rounded-[var(--radius-md)] bg-[var(--secondary)] px-3 py-2.5 text-left text-xs font-medium text-[var(--secondary-fg)] transition-transform hover:brightness-110 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            New chat
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {sessions.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--subtle)]">
              No chats yet. Start one from the home page.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {sessions.map((c) => {
                const count = Math.max(c.messages.length, c.messageCount ?? 0);
                const active = c.id === currentId;
                return (
                  <li
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-[var(--radius-md)] px-2 transition-colors ${
                      active ? "bg-[var(--chip)]" : "hover:bg-[var(--chip)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openConversationById(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-left"
                    >
                      <MessageSquare className="h-4 w-4 shrink-0 text-[var(--subtle)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--fg)]">
                          {c.title || "New thread"}
                        </span>
                        <span className="block text-xs text-[var(--subtle)]">
                          {count} message{count === 1 ? "" : "s"} · {timeAgo(c.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConversation(c.id)}
                      title="Delete chat"
                      aria-label={`Delete ${c.title || "chat"}`}
                      className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--subtle)] opacity-0 transition hover:text-[var(--danger)] group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
