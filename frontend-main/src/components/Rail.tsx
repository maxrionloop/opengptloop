import { MessageCircle, Brain, Library, Bot, Sparkles, Users, Boxes, FileText, Crown, ListChecks, Plug, Server, Cpu, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useStore, type Section } from "@/store/useStore";
import { findActiveProfile, isUsableAvatar, profileInitials } from "@/lib/userProfiles";
import { cn } from "@/utils/cn";

const NAV: Array<{ id: Section; label: string; Icon: typeof MessageCircle }> = [
  { id: "chat", label: "Chat history", Icon: MessageCircle },
  { id: "models", label: "Models", Icon: Cpu },
  { id: "customagents", label: "Custom agents", Icon: Boxes },
  { id: "systemprompts", label: "Custom system prompts", Icon: FileText },
  { id: "taskmodes", label: "Task modes", Icon: ListChecks },
  { id: "memory", label: "Memory", Icon: Brain },
  { id: "knowledge", label: "Knowledge base", Icon: Library },
  { id: "agents", label: "Sub-agents", Icon: Bot },
  { id: "skills", label: "Skills", Icon: Sparkles },
  { id: "teams", label: "Agent teams", Icon: Users },
  { id: "ceo", label: "CEO agents", Icon: Crown },
  { id: "connectors", label: "Connectors", Icon: Plug },
  { id: "mcp", label: "MCP servers", Icon: Server },
];

export function Rail() {
  const section = useStore((s) => s.section);
  const setSection = useStore((s) => s.setSection);
  const agentMode = useStore((s) => s.agentMode);
  const setAgentMode = useStore((s) => s.setAgentMode);
  const userProfiles = useStore((s) => s.userProfiles);
  const activeUserProfileId = useStore((s) => s.activeUserProfileId);
  const activeProfile = findActiveProfile(userProfiles, activeUserProfileId);
  const showAvatar = isUsableAvatar(activeProfile.avatar);
  const profilesActive = section === "profiles";
  const settingsActive = section === "settings";

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--rail)]"
      style={{ width: "var(--rail-w)" }}
    >
      <div className="flex flex-col items-center pt-4">
        <div
          className="grid h-10 w-10 place-items-center rounded-[var(--radius-md)] bg-[var(--secondary)] text-[var(--secondary-fg)]"
          aria-hidden
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </div>

        <div className="mt-3 w-full px-2">
          <div
            className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-1"
            role="group"
            aria-label="Conversation mode"
          >
            <ModeButton
              active={agentMode === "chat"}
              onClick={() => setAgentMode("chat")}
              title="Chat mode — talk to the LLM (memory, knowledge, web only)"
              label="Chat"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.9} />
            </ModeButton>
            <ModeButton
              active={agentMode === "agent"}
              onClick={() => setAgentMode("agent")}
              title="Agent mode — full tools (files, shell, sub-agents, …)"
              label="Agent"
            >
              <Bot className="h-4 w-4" strokeWidth={1.9} />
            </ModeButton>
          </div>
        </div>

        <nav aria-label="Workspace" className="mt-3 flex flex-col items-center gap-1">
          {NAV.map(({ id, label, Icon }) => {            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={active ? "page" : undefined}
                title={label}
                className={cn(
                  "group relative grid h-11 w-11 place-items-center rounded-[var(--radius-md)] transition-all duration-150 active:scale-95",
                  active
                    ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
                    : "text-[var(--muted)] hover:bg-[color:color-mix(in_oklab,var(--fg)_6%,transparent)] hover:text-[var(--fg)]",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={1.7} />
                <span className="sr-only">{label}</span>
                <span
                  className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-40 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--secondary-fg)] opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 max-[640px]:hidden"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2 pb-4">
        <button
          type="button"
          onClick={() => setSection("settings")}
          aria-current={settingsActive ? "page" : undefined}
          title="Settings"
          aria-label="Settings"
          className={cn(
            "group relative grid h-11 w-11 place-items-center rounded-[var(--radius-md)] transition-all duration-150 active:scale-95",
            settingsActive
              ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
              : "text-[var(--muted)] hover:bg-[color:color-mix(in_oklab,var(--fg)_6%,transparent)] hover:text-[var(--fg)]",
          )}
        >
          <Settings className="h-5 w-5" strokeWidth={1.7} />
          <span className="sr-only">Settings</span>
          <span
            className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-40 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--secondary-fg)] opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 max-[640px]:hidden"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            Settings
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSection("profiles")}
          aria-current={profilesActive ? "page" : undefined}
          title={activeProfile.name ? `Profiles — ${activeProfile.name}` : "Profiles"}
          aria-label="Profiles"
          className={cn(
            "group relative grid h-10 w-10 place-items-center overflow-hidden rounded-full transition-all duration-150 active:scale-95",
            profilesActive
              ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
              : "bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--fg)]",
          )}
          style={{ boxShadow: "var(--shadow-chip)" }}
        >
          {showAvatar ? (
            <img
              src={activeProfile.avatar}
              alt={activeProfile.name}
              className="h-full w-full object-cover"
            />
          ) : activeProfile.name ? (
            <span className="text-xs font-semibold uppercase tracking-wide">
              {profileInitials(activeProfile.name)}
            </span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M6.5 19c.8-2.8 2.8-4.2 5.5-4.2s4.7 1.4 5.5 4.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          )}
          <span className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-40 -translate-y-1/2 translate-x-[-4px] whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--secondary-fg)] opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 max-[640px]:hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {activeProfile.name ? `Profiles — ${activeProfile.name}` : "Profiles"}
          </span>
        </button>
      </div>
    </aside>
  );
}

function ModeButton({
  active,
  onClick,
  title,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      aria-label={label}
      className={cn(
        "flex w-full flex-col items-center gap-0.5 rounded-[var(--radius-sm)] px-1 py-1.5 transition-all duration-150 active:scale-95",
        active
          ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
          : "text-[var(--muted)] hover:text-[var(--fg)]",
      )}
    >
      {children}
      <span className="text-[9px] font-semibold uppercase leading-none tracking-wide">{label}</span>
    </button>
  );
}
