import { useEffect, useRef, useState } from "react";
import { Paperclip, ArrowUp, Square, FolderOpen } from "lucide-react";
import { useStore } from "@/store/useStore";
import { isCustomProviderId } from "@/lib/providers";
import { fetchWorkspace, mkdirWorkspace, setWorkspace } from "@/lib/workspace";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, TextInput } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

export function Composer({ onSend, onStop }: { onSend: (text: string) => void; onStop: () => void }) {
  const [value, setValue] = useState("");
  const streaming = useStore((s) => s.streaming);
  const settings = useStore((s) => s.settings);
  const customProviders = useStore((s) => s.customProviders);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSection = useStore((s) => s.setSection);
  const workspacePath = useStore((s) => s.workspacePath);
  const setWorkspacePath = useStore((s) => s.setWorkspacePath);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (workspacePath) return;
    fetchWorkspace()
      .then((workspace) => setWorkspacePath(workspace))
      .catch(() => {});
  }, [workspacePath, setWorkspacePath]);

  const isCustom = isCustomProviderId(settings.provider);
  const customProvider = customProviders.find((p) => p.id === settings.provider);
  const ready = isCustom
    ? Boolean(customProvider && settings.model)
    : Boolean(settings.apiKeys[settings.provider] && settings.model);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    if (!ready) {
      setSettingsOpen(true);
      return;
    }
    setSection("chat");
    onSend(text);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="relative shrink-0 px-6 pb-5 pt-2 max-[640px]:px-3 max-[640px]:pb-3">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-full h-10"
        style={{ background: "linear-gradient(to top, var(--bg), transparent)" }}
      />

      <div className="mx-auto w-full max-w-3xl">
        {!ready && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="mb-2 w-full rounded-[var(--radius-md)] border px-3 py-2 text-xs transition-colors"
            style={{
              borderColor: "color-mix(in oklab, var(--warning) 32%, transparent)",
              background: "var(--warning-soft)",
              color: "var(--warning)",
            }}
          >
            Add your API key and pick a model in Settings to start chatting.
          </button>
        )}

        <div
          className="rounded-[var(--radius-2xl)] bg-[var(--bg)] p-4 transition-shadow focus-within:[box-shadow:var(--shadow-card-focus)] max-[640px]:p-3"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <label htmlFor="composer" className="sr-only">
            Message
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            value={value}
            onChange={autoGrow}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="Ask Haku anything"
            className="block max-h-[200px] min-h-[4.5rem] w-full resize-none border-0 bg-transparent text-base leading-relaxed text-[var(--fg)] outline-none placeholder:text-[var(--subtle)]"
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                title="Add attachment"
                aria-label="Add attachment"
                className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]"
              >
                <Paperclip className="h-[18px] w-[18px]" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceOpen(true)}
                title={workspacePath ? `Workspace: ${workspacePath}` : "Choose workspace"}
                aria-label="Choose workspace"
                className="flex h-11 min-w-0 max-w-[12rem] items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--fg)]"
              >
                <FolderOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                <span className="truncate text-xs">
                  {workspacePath ? workspacePath.split("/").pop() || workspacePath : "Workspace"}
                </span>
              </button>
            </div>

            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop"
                aria-label="Stop"
                className="grid h-11 w-11 place-items-center rounded-full bg-[var(--secondary)] text-[var(--secondary-fg)] transition-transform active:scale-95"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                title="Send"
                aria-label="Send"
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-95",
                  value.trim()
                    ? "bg-[var(--secondary)] text-[var(--secondary-fg)]"
                    : "cursor-not-allowed bg-[var(--chip)] text-[var(--subtle)]",
                )}
              >
                <ArrowUp className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </button>
            )}
          </div>
        </div>

        <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-[var(--subtle)]">
          Haku can be wrong. Check anything that matters.
        </p>
      </div>

      <WorkspaceModal
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
      />
    </div>
  );
}

function WorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const workspacePath = useStore((s) => s.workspacePath);
  const setWorkspacePath = useStore((s) => s.setWorkspacePath);
  const [path, setPath] = useState(workspacePath);
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPath(workspacePath);
      setFolder("");
      setError(null);
      setNotice(null);
    }
  }, [open, workspacePath]);

  const switchWorkspace = async () => {
    const next = path.trim();
    if (!next) {
      setError("Enter a workspace path first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const workspace = await setWorkspace(next);
      setWorkspacePath(workspace);
      setNotice(`Workspace set to ${workspace}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createFolder = async () => {
    const name = folder.trim();
    if (!name) {
      setError("Enter a folder name first (e.g. <folder name> or <a>/<b>/<c>).");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const created = await mkdirWorkspace(name);
      setNotice(`Created folder ${created} inside the current workspace.`);
      setFolder("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={<FolderOpen className="h-4 w-4" />}
      title="Agent workspace"
      size="md"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-4 p-5">
        <Field label="Current agent workspace path" hint="where the agent reads/writes files">
          <div className="break-all rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] px-3 py-2 font-mono text-xs text-[var(--fg)]">
            {workspacePath || "(loading…)"}
          </div>
        </Field>

        <Field
          label="Switch workspace"
          hint="absolute path, or relative to the current workspace"
        >
          <TextInput
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/home/user/project or my-project/sub"
            className="font-mono text-xs"
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={switchWorkspace} disabled={busy}>
            Switch workspace
          </Button>
        </div>

        <Field
          label="Create new folder here"
          hint="<folder name> or <a>/<b>/<c>"
        >
          <TextInput
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g. docs or projects/app/docs"
            className="font-mono text-xs"
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="outline" onClick={createFolder} disabled={busy}>
            Create folder
          </Button>
        </div>

        {notice && <p className="text-xs text-[var(--success)]">{notice}</p>}
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
