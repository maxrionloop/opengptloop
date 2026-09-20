import { useEffect, useRef } from "react";
import { NetworkBanner } from "@/components/NetworkBanner";
import { ChatHistory } from "@/components/ChatHistory";
import { SettingsModal } from "@/components/editors/SettingsModal";
import { TodoPanel } from "@/components/overlays/TodoPanel";
import { FilesPanel } from "@/components/overlays/FilesPanel";
import { PreviewPanel } from "@/components/overlays/PreviewPanel";
import { MemoryAgentPanel } from "@/components/overlays/MemoryAgentPanel";
import { MemoryAgentSessionsPanel } from "@/components/overlays/MemoryAgentSessionsPanel";
import { TeamMonitorPanel } from "@/components/overlays/TeamMonitorPanel";
import { HomePage } from "@/pages/HomePage";
import { ChatPage } from "@/pages/ChatPage";
import { useStore } from "@/store/useStore";
import { useChatStream, useConnectionWatch } from "@/hooks/useChatStream";
import { parseLocation } from "@/lib/router";
import { fetchProviders } from "@/lib/api";
import { exchangeMcpOAuthCode, fetchMcpServers } from "@/lib/mcp";
import { fetchWorkspace } from "@/lib/workspace";
import { attachLatestMemoryAgentRun } from "@/lib/memoryAgent";
import {
  bootstrapFromBackend,
  loadConversationIfNeeded,
  startStatePersistence,
} from "@/lib/statePersistence";

export function App() {
  const section = useStore((s) => s.section);
  const route = useStore((s) => s.route);
  const currentId = useStore((s) => s.currentId);
  const hydrated = useStore((s) => s.hydrated);
  const setProviders = useStore((s) => s.setProviders);
  const { send, resume, stop } = useChatStream();
  const bootedRef = useRef(false);

  useConnectionWatch();

  // Keep the store's route in sync with browser back/forward navigation.
  useEffect(() => {
    const onPop = () => {
      const next = parseLocation(window.location.pathname);
      if (next.name === "chat") useStore.getState().openConversationById(next.sessionId);
      else useStore.getState().setRoute(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Boot: hydrate the runtime store from the backend SQLite database, start the
  // change-sync bridge, then re-attach to any run the backend is still executing —
  // a page refresh loses nothing and reconnects to the live stream immediately.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    fetchProviders().then(setProviders).catch(() => {});
    fetchWorkspace()
      .then((workspace) => useStore.getState().setWorkspacePath(workspace))
      .catch(() => {});

    void (async () => {
      // OAuth landings: the backend redirects here after a backend-mode MCP
      // flow (?mcp_connected=<id> or ?mcp_error=<message>), and the provider
      // redirects here directly after a frontend-mode MCP flow
      // (?mcp_oauth=1&code=…&state=mcp_…). Refresh the list and land on the
      // MCP page so the user sees the result.
      try {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get("mcp_connected");
        const oauthError = params.get("mcp_error");
        const oauthCode = params.get("code");
        const oauthState = params.get("state");
        const isFrontendReturn =
          (params.get("mcp_oauth") !== null || params.get("mcp") !== null) &&
          Boolean(oauthCode) &&
          (oauthState ?? "").startsWith("mcp_");
        if (connected || oauthError || isFrontendReturn) {
          // Strip the query string but keep the current path (home or /chat/<id>).
          window.history.replaceState({}, "", window.location.pathname);
          if (isFrontendReturn && oauthCode && oauthState) {
            // Frontend redirect mode: complete the code exchange with the backend.
            try {
              const server = await exchangeMcpOAuthCode(oauthCode, oauthState);
              useStore.getState().upsertMcpServer(server);
            } catch (e) {
              // The server row records the failure; still land on the MCP page.
              void e;
            }
          }
          fetchMcpServers()
            .then((servers) => useStore.getState().setMcpServers(servers))
            .catch(() => {});
          useStore.getState().setSection("mcp");
        }
      } catch {
        // ignore malformed URLs
      }

      const payload = await bootstrapFromBackend();
      startStatePersistence();

      const store = useStore.getState();
      const activeRoute = store.route;
      if (activeRoute.name === "chat") {
        // Deep link / refresh on /chat/<id>: open that session (adds a stub for unknown
        // ids; the effect below loads its snapshot from the database).
        store.openConversationById(activeRoute.sessionId);
      } else {
        // Home: lazily load the last-active session so switching to it is instant, but
        // stay on the landing page.
        const activeId = store.currentId;
        if (activeId) await loadConversationIfNeeded(activeId);
      }

      // Load the memory-agent sessions overview and re-attach to any run the backend
      // queue is still executing (the agent keeps running regardless of the browser).
      void attachLatestMemoryAgentRun();

      // Re-attach to a still-running stream (survives refresh/close/reconnect) — but only
      // when we are actually viewing that chat, and it belongs to the active profile.
      // Profiles are strictly isolated: another profile's running turn must never surface.
      const running = payload.sessions.find((s) => s.running);
      if (running) {
        const peer = useStore.getState();
        const owner = peer.conversations.find((c) => c.id === running.id);
        const viewingRun = peer.route.name === "chat" && peer.route.sessionId === running.id;
        if (
          viewingRun &&
          owner &&
          (owner.profileId ?? null) === (peer.activeUserProfileId ?? null)
        ) {
          await loadConversationIfNeeded(running.id);
          void resume({
            chatId: running.id,
            assistantId: "", // rebuilt by resume(): a fresh placeholder receives the replay
            lastEventId: -1,
            startedAt: Date.now(),
          });
        }
      }
    })();
  }, [resume, setProviders]);

  // Lazily pull a conversation's stored snapshot from the database when it is opened.
  useEffect(() => {
    if (!hydrated || !currentId) return;
    void loadConversationIfNeeded(currentId);
  }, [hydrated, currentId]);

  // The landing page shows only when we are on the home route and not inside a workspace
  // panel; everything else (a live chat, or any open panel) uses the full chat shell.
  const showHome = route.name === "home" && section === "chat";

  return (
    <>
      {showHome ? (
        <HomePage onSend={send} onStop={stop} />
      ) : (
        <ChatPage onSend={send} onStop={stop} />
      )}

      <ChatHistory />
      <NetworkBanner />
      <SettingsModal />
      <TodoPanel />
      <FilesPanel />
      <PreviewPanel />
      <MemoryAgentPanel />
      <MemoryAgentSessionsPanel />
      <TeamMonitorPanel />
    </>
  );
}
