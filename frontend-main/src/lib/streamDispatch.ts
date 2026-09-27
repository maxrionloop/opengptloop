import { useStore } from "@/store/useStore";
import { uid } from "@/utils/id";
import { watchMemoryAgentRun } from "@/lib/memoryAgent";
import { normalizeMcpServers } from "@/lib/mcp";
import type { StreamBatcher } from "@/lib/streamBatcher";
import type {
  AttachedFile,
  KnowledgeFile,
  MemoryFile,
  SSEEventData,
  TodoItem,
} from "@/types";

type Store = ReturnType<typeof useStore.getState>;

export interface DispatchContext {
  convId: string;
  msgId: string;
  batcher: StreamBatcher;
  onFilesChanged?: () => void;
  /** When resuming a run, the message is reset once on the first replayed event. */
  resume: { pending: boolean };
}

function normalizeAttachedFiles(raw: unknown, prefix = "att"): AttachedFile[] {
  if (!Array.isArray(raw)) return [];
  const out: AttachedFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const path =
      typeof record.path === "string" && record.path.trim().length > 0 ? record.path.trim() : "";
    if (!path) continue;
    const name =
      typeof record.name === "string" && record.name.trim().length > 0
        ? record.name.trim()
        : (path.split("/").pop() ?? path);
    out.push({
      id: uid(prefix),
      name,
      path,
      size: typeof record.size === "number" ? record.size : 0,
      content_type:
        typeof record.content_type === "string" ? record.content_type : "application/octet-stream",
      size_label: typeof record.size_label === "string" ? record.size_label : undefined,
    });
  }
  return out;
}

/** Build the batch tool-chip label, e.g. "Sub-Agents (3): alpha, beta, gamma". */
function multiSubAgentLabel(children: Array<{ run: { agent: string } }>): string {
  const names = children.map((c) => c.run.agent).filter((n) => n.length > 0);
  const shown = names.slice(0, 3).join(", ");
  const extra = names.length > 3 ? `, +${names.length - 3} more` : "";
  return `Sub-Agents (${children.length}): ${shown}${extra}`.trim();
}

function extractUrl(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url : "";
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "";
}

function persistCreatedSubAgent(s: Store, raw: Record<string, unknown>): void {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return;
  const description = typeof raw.description === "string" ? raw.description : "";
  const systemPrompt = typeof raw.system_prompt === "string" ? raw.system_prompt : "";
  const tools = Array.isArray(raw.tools) ? raw.tools.filter((t): t is string => typeof t === "string") : [];
  const existing = s.subAgents.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
  if (existing) s.updateSubAgent(existing.id, { name, description, systemPrompt, tools, enabled: true });
  else s.addSubAgent({ name, description, systemPrompt, tools, enabled: true });
}

function persistDeletedSubAgent(s: Store, rawName: unknown): void {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return;
  // Remove the user-defined sub-agent matching the name (case-insensitive). Built-in defaults
  // (id prefixed with "default-") are never removed — the backend already blocks deleting them.
  const target = s.subAgents.find(
    (a) => !a.id.startsWith("default-") && a.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (target) s.deleteSubAgent(target.id);
}

function persistDeletedSkill(s: Store, rawName: unknown): void {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name) return;
  // Remove the user-defined skill matching the name (case-insensitive). Built-in defaults
  // (id prefixed with "default-") are never removed — the backend already blocks deleting them.
  const target = s.skills.find(
    (sk) => !sk.id.startsWith("default-") && sk.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (target) s.deleteSkill(target.id);
}

function persistCreatedSkill(s: Store, raw: Record<string, unknown>): void {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return;
  const description = typeof raw.description === "string" ? raw.description : "";
  const skillFile = (
    typeof raw.skill_file === "string" && raw.skill_file.trim().length > 0 ? raw.skill_file : "SKILL.md"
  ).replace(/^[\\/]+/, "");
  const rawFiles = Array.isArray(raw.files) ? raw.files : [];
  const files: Array<{ path: string; content: string }> = [];
  for (const f of rawFiles) {
    if (!f || typeof f !== "object") continue;
    const rec = f as Record<string, unknown>;
    const p = typeof rec.path === "string" ? rec.path.trim().replace(/^[\\/]+/, "") : "";
    if (!p) continue;
    files.push({ path: p, content: typeof rec.content === "string" ? rec.content : "" });
  }
  const entry = files.find((f) => f.path.toLowerCase() === skillFile.toLowerCase());
  const entryContent = entry?.content ?? "";
  const skillContent =
    typeof raw.skill_content === "string" && raw.skill_content.trim().length > 0
      ? raw.skill_content
      : entryContent;
  const extraFiles = files.filter((f) => f.path.toLowerCase() !== skillFile.toLowerCase());
  const existing = s.skills.find((sk) => sk.name.trim().toLowerCase() === name.toLowerCase());
  if (existing)
    s.updateSkill(existing.id, {
      name,
      description,
      skillFile,
      skillContent,
      files: extraFiles,
      enabled: true,
    });
  else s.addSkill({ name, description, skillFile, skillContent, files: extraFiles, enabled: true });
}

/**
 * Apply a single SSE event to the store. Token/reasoning events go through the batcher
 * (rAF-coalesced); everything else is applied immediately after flushing the batcher so
 * ordering between streamed text and structured events is preserved.
 */
export function dispatchStreamEvent(event: string, data: SSEEventData, ctx: DispatchContext): void {
  const { convId, msgId, batcher } = ctx;
  const s = useStore.getState();

  // On the first replayed event of a resume, wipe the (possibly partial) message once so the
  // full replay rebuilds it deterministically — no duplicated or missing tokens.
  if (ctx.resume.pending) {
    ctx.resume.pending = false;
    s.resetMessageStream(convId, msgId);
  }

  switch (event) {
    case "reasoning":
      batcher.appendReasoning(String(data.value ?? ""));
      return;
    case "token":
      batcher.token(String(data.value ?? ""));
      return;
    case "sub_agent_reasoning":
      batcher.subReasoning(String(data.id ?? ""), String(data.value ?? ""));
      return;
    case "sub_agent_token":
      batcher.subToken(String(data.id ?? ""), String(data.value ?? ""));
      return;
    case "team_agent_reasoning":
      batcher.teamReasoning(String(data.agent_id ?? ""), String(data.value ?? ""));
      return;
    case "team_agent_token":
      batcher.teamToken(String(data.agent_id ?? ""), String(data.value ?? ""));
      return;
  }

  // Non-delta event → make sure buffered text lands first.
  batcher.flush();

  switch (event) {
    case "tool_call":
      s.upsertTool(convId, msgId, {
        id: String(data.id ?? uid("tool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: "running",
        args: (data.args as Record<string, unknown> | undefined) ?? undefined,
        filePath: (data.args as Record<string, unknown> | undefined)?.file_path as string | undefined,
      });
      break;

    case "plan_review": {
      const planId = String(data.id ?? uid("tool"));
      s.setPlanPending(convId, msgId, planId, {
        id: planId,
        chatId: String(data.chat_id ?? convId),
        plan: String(data.plan ?? ""),
      });
      break;
    }

    case "ask_question": {
      const askId = String(data.id ?? uid("tool"));
      const questions = (data.questions ?? []).map((q) => ({
        question: String(q?.question ?? ""),
        context: String(q?.context ?? ""),
        options: (q?.options ?? []).map((o) => String(o)),
      }));
      s.setQuestionPending(convId, msgId, askId, {
        id: askId,
        chatId: String(data.chat_id ?? convId),
        questions,
      });
      break;
    }

    case "tool_result": {
      const ok = Boolean(data.ok);
      const id = String(data.id ?? uid("tool"));
      const name = String(data.name ?? "tool");
      const result = (data.result ?? {}) as { decision?: string } | undefined;
      s.upsertTool(convId, msgId, {
        id,
        name,
        label: String(data.label ?? data.name ?? "tool"),
        status: ok ? "ok" : "error",
        result: data.result,
      });

      const payload = (data.result as Record<string, unknown> | undefined)?.data as
        | Record<string, unknown>
        | undefined;
      if (ok && name === "create_sub_agent" && payload?.created_sub_agent) {
        persistCreatedSubAgent(s, payload.created_sub_agent as Record<string, unknown>);
      }
      if (ok && name === "delete_sub_agent" && payload?.deleted_sub_agent) {
        persistDeletedSubAgent(s, payload.deleted_sub_agent);
      }
      if (ok && name === "create_skill" && payload?.created_skill) {
        persistCreatedSkill(s, payload.created_skill as Record<string, unknown>);
      }
      if (ok && name === "delete_skill" && payload?.deleted_skill) {
        persistDeletedSkill(s, payload.deleted_skill);
      }
      if ((name === "TodoWrite" || name === "read_todos") && Array.isArray(payload?.todos)) {
        s.setTodos(payload.todos as TodoItem[]);
      }
      if (name === "embed_url") {
        const url = extractUrl(data.result);
        if (url) {
          s.setPreview(url);
          s.setPreviewOpen(true);
        }
      }
      if (name === "attach_files") {
        const files = normalizeAttachedFiles(payload?.files, "att");
        if (files.length > 0) {
          s.addAttachedFiles(files);
          s.setFilesOpen(true);
        }
      }
      if (name === "submit_plan" && result?.decision) {
        const map: Record<string, "approved" | "canceled" | "edited" | "timeout"> = {
          approved: "approved",
          edited: "edited",
          canceled: "canceled",
          timeout: "timeout",
        };
        const planStatus = map[result.decision];
        if (planStatus) s.setPlanStatus(convId, msgId, id, planStatus);
      }
      if (
        name === "ask_question_to_user" &&
        (result?.decision === "answered" || result?.decision === "timeout")
      ) {
        s.setQuestionStatus(convId, msgId, id, result.decision === "answered" ? "answered" : "timeout");
      }
      ctx.onFilesChanged?.();
      break;
    }

    case "todo_updated":
      if (Array.isArray(data.todos)) s.setTodos(data.todos as TodoItem[]);
      break;

    case "memory_updated":
      if (Array.isArray(data.memoryFiles)) s.setMemory(data.memoryFiles as MemoryFile[]);
      break;

    case "memory_agent_queued":
      // The turn just enqueued a background memory-build run — attach to its stream so the
      // popup can show it live and the agent's memory updates mirror into this browser.
      if (typeof data.run_id === "string" && data.run_id.length > 0) {
        watchMemoryAgentRun(data.run_id);
      }
      break;

    case "knowledge_updated":
      if (Array.isArray(data.knowledgeFiles)) s.setKnowledge(data.knowledgeFiles as KnowledgeFile[]);
      break;

    case "mcp_servers_updated":
      // An agent-driven MCP management tool mutated the persisted servers.
      // Mirror the backend truth into the store so the MCP page + the next
      // chat turn (which sends enabled server ids) converge immediately.
      if (Array.isArray((data as Record<string, unknown>).servers)) {
        try {
          const raw = (data as Record<string, unknown>).servers;
          const normalized = normalizeMcpServers(raw);
          if (normalized.length > 0 || (raw as unknown[]).length === 0) {
            s.setMcpServers(normalized);
          }
        } catch {
          // best effort — the MCP page refetches on open anyway
        }
      }
      break;

    case "mcp_oauth_required": {
      // The agent started an OAuth MCP connection and is blocked waiting for
      // the user (up to 3 minutes). Stash the pending server on the tool block
      // so the Connect button can resolve its server id even before tool_result.
      const toolId =
        typeof (data as Record<string, unknown>).tool_call_id === "string"
          ? ((data as Record<string, unknown>).tool_call_id as string)
          : null;
      const serverId =
        typeof (data as Record<string, unknown>).server_id === "string"
          ? ((data as Record<string, unknown>).server_id as string)
          : null;
      const serverName =
        typeof (data as Record<string, unknown>).server_name === "string"
          ? ((data as Record<string, unknown>).server_name as string)
          : null;
      if (toolId && serverId) {
        s.upsertTool(convId, msgId, {
          id: toolId,
          name: "connect_remote_mcp",
          label: serverName ? `Connect MCP: ${serverName}` : "Connect MCP server",
          status: "running",
          result: { oauth_pending: true, server_id: serverId, server_name: serverName } as never,
        });
      }
      break;
    }

    case "embed_url": {
      const url = extractUrl(data);
      if (url) {
        s.setPreview(url);
        s.setPreviewOpen(true);
      }
      break;
    }

    case "attach_files": {
      const files = normalizeAttachedFiles(data.files, "att");
      if (files.length > 0) {
        s.addAttachedFiles(files);
        s.setFilesOpen(true);
      }
      break;
    }

    case "multi_sub_agents_start": {
      // A call_multiple_sub_agents batch was launched. Pre-create one run slot per child so every
      // sub-agent renders its own block inside the batch tool block, in the requested order.
      const parentId = String(data.id ?? uid("tool"));
      const list = Array.isArray(data.agents) ? data.agents : [];
      const children = list.map((a, i) => ({
        id: String(a?.id ?? `${parentId}::${i}`),
        run: {
          agent: String(a?.agent ?? ""),
          task: String(a?.task ?? ""),
          background: a?.background === true,
          sentContext: a?.context_shared === true,
          error: a?.error != null ? String(a.error) : undefined,
        },
      }));
      s.startMultiSubAgents(convId, msgId, parentId, multiSubAgentLabel(children), children);
      break;
    }

    case "sub_agent_start": {
      const parentToolId = data.parent_tool_id != null ? String(data.parent_tool_id) : undefined;
      const run = {
        agent: String(data.agent ?? ""),
        task: String(data.task ?? ""),
        background: data.background === true,
        sentContext: data.context_shared === true,
        outputFile: data.output_file != null ? String(data.output_file) : undefined,
      };
      if (parentToolId) s.startSubAgentInParent(convId, msgId, parentToolId, String(data.id ?? ""), run);
      else s.startSubAgent(convId, msgId, String(data.id ?? ""), run);
      break;
    }

    case "sub_agent_background_started": {
      // A background (wait_for_output=false) sub-agent was launched and detached from the turn.
      // Register the run so the chip renders even though no further sub_agent_* events may arrive
      // once the main turn ends (the sub-agent writes its result to the output_file instead).
      const parentToolId = data.parent_tool_id != null ? String(data.parent_tool_id) : undefined;
      const run = {
        agent: String(data.agent ?? ""),
        task: String(data.task ?? ""),
        background: true,
        sentContext: data.context_shared === true,
        outputFile: data.output_file != null ? String(data.output_file) : undefined,
      };
      if (parentToolId) s.startSubAgentInParent(convId, msgId, parentToolId, String(data.id ?? ""), run);
      else s.startSubAgent(convId, msgId, String(data.id ?? ""), run);
      break;
    }

    case "sub_agent_tool_call": {
      const parentToolId = data.parent_tool_id != null ? String(data.parent_tool_id) : undefined;
      const subTool = {
        id: String(data.tool_id ?? uid("subtool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: "running" as const,
        args: (data.args as Record<string, unknown> | undefined) ?? undefined,
        filePath: (data.args as Record<string, unknown> | undefined)?.file_path as string | undefined,
      };
      if (parentToolId)
        s.upsertSubAgentToolInParent(convId, msgId, parentToolId, String(data.id ?? ""), subTool);
      else s.upsertSubAgentTool(convId, msgId, String(data.id ?? ""), subTool);
      break;
    }

    case "sub_agent_tool_result": {
      const parentToolId = data.parent_tool_id != null ? String(data.parent_tool_id) : undefined;
      const subTool = {
        id: String(data.tool_id ?? uid("subtool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: (data.ok ? "ok" : "error") as "ok" | "error",
        result: data.result,
      };
      if (parentToolId)
        s.upsertSubAgentToolInParent(convId, msgId, parentToolId, String(data.id ?? ""), subTool);
      else s.upsertSubAgentTool(convId, msgId, String(data.id ?? ""), subTool);
      ctx.onFilesChanged?.();
      break;
    }

    case "sub_agent_done": {
      const parentToolId = data.parent_tool_id != null ? String(data.parent_tool_id) : undefined;
      const patch = {
        status: (data.ok ? "ok" : "error") as "ok" | "error",
        output: data.output != null ? String(data.output) : undefined,
        error: data.error != null ? String(data.error) : undefined,
      };
      if (parentToolId) s.finishSubAgentInParent(convId, msgId, parentToolId, String(data.id ?? ""), patch);
      else s.finishSubAgent(convId, msgId, String(data.id ?? ""), patch);
      break;
    }

    // ---- Multi-agent team events ----
    case "team_start": {
      const roster = (Array.isArray(data.members) ? data.members : []).map((m) => ({
        id: String(m?.agent_id ?? ""),
        name: String(m?.agent_id ?? ""),
        role: (m?.role === "leader" ? "leader" : "member") as "leader" | "member",
        description: m?.description != null ? String(m.description) : undefined,
        status: "idle" as const,
        queued: 0,
        segments: [],
      }));
      s.startTeamRun(convId, msgId, {
        teamName: String(data.team_name ?? "Agent team"),
        leaderId: String(data.leader_id ?? ""),
        sendMessageEnabled: data.send_message_enabled === true,
        roster,
      });
      break;
    }

    case "team_agent_start":
      s.startTeamAgentSegment(convId, msgId, String(data.agent_id ?? ""), {
        role: data.role === "leader" ? "leader" : "member",
        trigger: data.trigger != null ? String(data.trigger) : undefined,
      });
      break;

    case "team_agent_tool_call":
      s.upsertTeamAgentTool(convId, msgId, String(data.agent_id ?? ""), {
        id: String(data.tool_id ?? uid("ttool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: "running",
        args: (data.args as Record<string, unknown> | undefined) ?? undefined,
        filePath: (data.args as Record<string, unknown> | undefined)?.file_path as string | undefined,
      });
      break;

    case "team_agent_tool_result":
      s.upsertTeamAgentTool(convId, msgId, String(data.agent_id ?? ""), {
        id: String(data.tool_id ?? uid("ttool")),
        name: String(data.name ?? "tool"),
        label: String(data.label ?? data.name ?? "tool"),
        status: data.ok ? "ok" : "error",
        result: data.result,
      });
      ctx.onFilesChanged?.();
      break;

    case "team_agent_segment":
      // The agent finished a run; nothing extra to store (tokens already streamed).
      break;

    case "team_agent_done":
      s.setTeamAgentStatus(convId, msgId, String(data.agent_id ?? ""), {
        status: (data.status as "completed" | "failed" | undefined) ?? (data.ok ? "completed" : "failed"),
      });
      break;

    case "team_status":
      s.setTeamAgentStatus(convId, msgId, String(data.agent_id ?? ""), {
        status: data.status as
          | "idle"
          | "working"
          | "queued"
          | "completed"
          | "failed"
          | undefined,
        queued: typeof data.queued === "number" ? data.queued : undefined,
      });
      break;

    case "team_message":
      s.addTeamMonitorMessage(convId, msgId, {
        from: data.from != null ? String(data.from) : undefined,
        to: data.to != null ? String(data.to) : undefined,
        kind: data.kind,
        text: data.message != null ? String(data.message) : undefined,
      });
      break;

    case "error":
      s.applyAssistantDelta(convId, msgId, {
        contentDelta: `\n\n⚠️ ${String(data.message ?? "Agent error")}`,
      });
      break;

    default:
      break;
  }
}
