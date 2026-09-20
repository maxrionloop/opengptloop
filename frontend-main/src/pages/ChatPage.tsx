import { Rail } from "@/components/Rail";
import { TopBar } from "@/components/TopBar";
import { Composer } from "@/components/Composer";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ModelsPanel } from "@/components/panels/ModelsPanel";
import { MemoryPanel } from "@/components/panels/MemoryPanel";
import { KnowledgePanel } from "@/components/panels/KnowledgePanel";
import { AgentsPanel } from "@/components/panels/AgentsPanel";
import { SkillsPanel } from "@/components/panels/SkillsPanel";
import { TeamsPanel } from "@/components/panels/TeamsPanel";
import { CeoPanel } from "@/components/panels/CeoPanel";
import { CustomAgentsPanel } from "@/components/panels/CustomAgentsPanel";
import { MainAgentPromptsPanel } from "@/components/panels/MainAgentPromptsPanel";
import { TaskModesPanel } from "@/components/panels/TaskModesPanel";
import { ConnectorsPanel } from "@/components/panels/ConnectorsPanel";
import { McpPanel } from "@/components/panels/McpPanel";
import { ProfilesPanel } from "@/components/panels/ProfilesPanel";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { useStore } from "@/store/useStore";

/**
 * The chat page — the full workspace shell: sidebar, top bar, the active chat (or a
 * workspace panel), and the prompt box docked at the bottom. Reached at /chat/<sessionId>
 * (a live conversation) or whenever a workspace panel is open.
 */
export function ChatPage({
  onSend,
  onStop,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const section = useStore((s) => s.section);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
      <Rail />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <main className="relative flex min-h-0 flex-1 flex-col">
          {section === "chat" && <ChatPanel onSend={onSend} />}
          {section !== "chat" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6 max-[640px]:px-4">
              {section === "memory" && <MemoryPanel />}
              {section === "models" && <ModelsPanel />}
              {section === "knowledge" && <KnowledgePanel />}
              {section === "agents" && <AgentsPanel />}
              {section === "skills" && <SkillsPanel />}
              {section === "teams" && <TeamsPanel />}
              {section === "ceo" && <CeoPanel />}
              {section === "customagents" && <CustomAgentsPanel />}
              {section === "systemprompts" && <MainAgentPromptsPanel />}
              {section === "taskmodes" && <TaskModesPanel />}
              {section === "connectors" && <ConnectorsPanel />}
              {section === "mcp" && <McpPanel />}
              {section === "profiles" && <ProfilesPanel />}
              {section === "settings" && <SettingsPanel />}
            </div>
          )}
        </main>

        <Composer onSend={onSend} onStop={onStop} />
      </div>
    </div>
  );
}
