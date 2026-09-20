import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plug, Plus, RefreshCw, Rocket, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { fetchModels, fetchProviders } from "@/lib/api";
import {
  FALLBACK_PROVIDERS,
  LMSTUDIO_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_BASE_URL,
  isCustomProviderId,
  isLocalProviderId,
} from "@/lib/providers";
import type { CustomHeader, CustomProvider } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, TextInput } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

/**
 * Quick start popup.
 *
 * Minimal first-run setup: AI model provider only (provider + API key / base
 * URL + model + custom providers). Every other preference lives on the
 * dedicated Settings page in the sidebar.
 *
 * The popup cannot be dismissed until a provider is configured and a model is
 * selected, so the app never ends up in an unusable state.
 */
export function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const hydrated = useStore((s) => s.hydrated);
  const providers = useStore((s) => s.providers);
  const models = useStore((s) => s.models);
  const modelsLoading = useStore((s) => s.modelsLoading);
  const settings = useStore((s) => s.settings);
  const customProviders = useStore((s) => s.customProviders);
  const setProviders = useStore((s) => s.setProviders);
  const setModels = useStore((s) => s.setModels);
  const setModelsLoading = useStore((s) => s.setModelsLoading);
  const setSettings = useStore((s) => s.setSettings);
  const setApiKey = useStore((s) => s.setApiKey);
  const updateCustomProvider = useStore((s) => s.updateCustomProvider);
  const deleteCustomProvider = useStore((s) => s.deleteCustomProvider);
  const selectCustomProvider = useStore((s) => s.selectCustomProvider);

  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");

  useEffect(() => {
    if (open && providers.length === 0) fetchProviders().then(setProviders).catch(() => {});
  }, [open, providers.length, setProviders]);

  const builtIns = providers.length > 0 ? providers : FALLBACK_PROVIDERS;
  const isCustom = isCustomProviderId(settings.provider);
  const selectedCustom = customProviders.find((p) => p.id === settings.provider);
  const editingProvider = customProviders.find((p) => p.id === editingId);
  const currentKey = isCustom ? (selectedCustom?.apiKey ?? "") : (settings.apiKeys[settings.provider] ?? "");
  const defaultBaseUrl = isCustom ? selectedCustom?.baseUrl : builtIns.find((p) => p.id === settings.provider)?.defaultBaseUrl;
  const modelOptions = isCustom ? (selectedCustom?.models ?? []).filter((m) => m.trim()) : models.map((m) => m.id);
  const isLocal = isLocalProviderId(settings.provider);

  const allProviders = useMemo(
    () => [
      ...builtIns.map((p) => ({ id: p.id, label: p.label, custom: false as const })),
      ...customProviders.map((p) => ({ id: p.id, label: p.name || p.id, custom: true as const })),
    ],
    [builtIns, customProviders],
  );

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    if (!q) return allProviders;
    return allProviders.filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [allProviders, providerQuery]);

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return modelOptions;
    return modelOptions.filter((m) => m.toLowerCase().includes(q));
  }, [modelOptions, modelQuery]);

  /** Ready = a usable provider credential (or local/custom) plus a selected model. */
  const ready = useMemo(() => {
    if (!settings.model.trim()) return false;
    if (isCustom) return Boolean(selectedCustom);
    if (isLocal) return true;
    return Boolean((settings.apiKeys[settings.provider] ?? "").trim());
  }, [settings, isCustom, selectedCustom, isLocal]);

  // First run: force the quick start open until the model is configured.
  useEffect(() => {
    if (hydrated && !ready && !open) setOpen(true);
  }, [hydrated, ready, open, setOpen]);

  const requestClose = () => {
    if (!ready) return;
    setOpen(false);
    setEditorOpen(false);
  };

  const handleProvider = (value: string) => {
    setError(null);
    setModelQuery("");
    if (isCustomProviderId(value)) {
      selectCustomProvider(value);
      setModels([]);
    } else {
      setSettings({ provider: value, model: "", baseUrl: "" });
      setModels([]);
    }
  };

  const loadModels = async () => {
    if (!currentKey && !isLocal) {
      setError("Enter an API key first.");
      return;
    }
    setError(null);
    setModelsLoading(true);
    try {
      const list = await fetchModels(settings.provider, currentKey, settings.baseUrl || undefined);
      setModels(list);
      if (list.length > 0 && !list.some((m) => m.id === settings.model)) setSettings({ model: list[0].id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title="Quick start"
        icon={<Rocket className="h-4 w-4" />}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <span className={cn("text-xs", ready ? "text-[var(--success)]" : "text-[var(--muted)]")}>
              {ready ? "Ready — you can start chatting." : "Add your API key and pick a model to continue."}
            </span>
            <Button onClick={requestClose} disabled={!ready} title={ready ? "Done" : "Configure a provider and model first"}>
              <Check className="h-4 w-4" /> Done
            </Button>
          </div>
        }
      >
        <div className="space-y-5 p-5">
          <p className="m-0 text-sm leading-relaxed text-[var(--muted)]">
            Connect an AI model to start. Everything else lives on the Settings page.
          </p>

          {/* 1 · Provider */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">1 · Provider</h3>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--subtle)]" />
              <input
                value={providerQuery}
                onChange={(e) => setProviderQuery(e.target.value)}
                placeholder="Search providers…"
                aria-label="Search providers"
                className="w-full bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--subtle)]"
              />
              {providerQuery && (
                <button type="button" onClick={() => setProviderQuery("")} aria-label="Clear provider search" className="text-[var(--subtle)] hover:text-[var(--fg)]">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {filteredProviders.length === 0 ? (
              <p className="m-0 px-1 py-2 text-center text-xs text-[var(--subtle)]">No providers match “{providerQuery}”.</p>
            ) : (
              <div className="grid max-h-52 grid-cols-2 gap-1.5 overflow-auto max-[520px]:grid-cols-1">
                {filteredProviders.map((p) => {
                  const active = settings.provider === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProvider(p.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left transition-colors",
                        active ? "border-[var(--secondary)] bg-[var(--chip)]" : "border-[var(--border)] hover:border-[var(--secondary)]",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--fg)]">{p.label}</span>
                        <span className="block truncate font-mono text-[10px] text-[var(--subtle)]">{p.custom ? "custom" : p.id}</span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-[var(--secondary)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2 · Key & endpoint */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">2 · Key & endpoint</h3>
            {isCustom ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-3 text-xs text-[var(--muted)]">
                Connected to {selectedCustom?.baseUrl || "no base URL"}. Manage its models below.
              </div>
            ) : (
              <>
                {isLocal && (
                  <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-3 text-xs leading-relaxed text-[var(--muted)]">
                    Local models need no API key. Start Ollama (`ollama serve`) or LM Studio, then load models.
                  </div>
                )}
                <Field label={isLocal ? "API key (optional)" : "API key"}>
                  <TextInput type="password" value={currentKey} onChange={(e) => setApiKey(settings.provider, e.target.value)} placeholder={isLocal ? "Not needed" : "sk-…"} />
                </Field>
                <Field label="Base URL (optional)">
                  <TextInput value={settings.baseUrl} onChange={(e) => setSettings({ baseUrl: e.target.value })} placeholder={defaultBaseUrl ? `Default: ${defaultBaseUrl}` : "https://…/v1"} className="font-mono text-xs" />
                  {isLocal && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setSettings({ baseUrl: OLLAMA_DEFAULT_BASE_URL })} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg)] hover:border-[var(--secondary)]">
                        Ollama · :11434
                      </button>
                      <button type="button" onClick={() => setSettings({ baseUrl: LMSTUDIO_DEFAULT_BASE_URL })} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg)] hover:border-[var(--secondary)]">
                        LM Studio · :1234
                      </button>
                    </div>
                  )}
                </Field>
              </>
            )}
          </section>

          {/* 3 · Model */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">3 · Model</h3>
              {!isCustom && (
                <button
                  type="button"
                  onClick={loadModels}
                  disabled={modelsLoading}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] hover:border-[var(--secondary)] disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3 w-3", modelsLoading && "animate-spin")} />
                  {modelsLoading ? "Loading…" : "Load models"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-[var(--subtle)]" />
              <input
                value={modelQuery}
                onChange={(e) => setModelQuery(e.target.value)}
                placeholder="Search models…"
                aria-label="Search models"
                className="w-full bg-transparent text-sm text-[var(--fg)] outline-none placeholder:text-[var(--subtle)]"
              />
              {modelQuery && (
                <button type="button" onClick={() => setModelQuery("")} aria-label="Clear model search" className="text-[var(--subtle)] hover:text-[var(--fg)]">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {filteredModels.length === 0 ? (
              <p className="m-0 px-1 py-2 text-center text-xs text-[var(--subtle)]">
                {modelOptions.length === 0 ? "No models yet — press Load models or add a custom provider." : "No matching models."}
              </p>
            ) : (
              <div className="max-h-52 space-y-0.5 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] p-1.5">
                {filteredModels.map((m) => {
                  const active = settings.model === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettings({ model: m })}
                      aria-pressed={active}
                      className={cn("flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--chip)]", active && "bg-[var(--chip)]")}
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--fg)]">{m}</span>
                      {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--secondary)]" />}
                    </button>
                  );
                })}
              </div>
            )}
            <Field label="Or type a model id">
              <TextInput value={settings.model} onChange={(e) => setSettings({ model: e.target.value })} placeholder="e.g. gpt-4o-mini" className="font-mono text-xs" />
            </Field>
          </section>

          {/* Custom providers */}
          <section className="space-y-2.5 border-t border-[var(--border)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Custom providers</h3>
            {customProviders.length > 0 && (
              <ul className="space-y-2">
                {customProviders.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-sm font-medium text-[var(--fg)]">
                        {p.name || p.id}
                        {settings.provider === p.id && <span className="ml-2 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] text-[var(--secondary-fg)]">Active</span>}
                      </p>
                      <p className="m-0 truncate text-xs text-[var(--subtle)]">{p.baseUrl || "no base URL"} · {p.models.filter((m) => m.trim()).length} model(s)</p>
                    </div>
                    <button onClick={() => selectCustomProvider(p.id)} title="Use" className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--subtle)] hover:bg-[var(--chip)] hover:text-[var(--fg)]">
                      <Plug className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setEditingId(p.id); setEditorOpen(true); }} title="Edit" className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--subtle)] hover:bg-[var(--chip)] hover:text-[var(--fg)]">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteCustomProvider(p.id)} title="Delete" className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--subtle)] hover:text-[var(--danger)]">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="w-full border-dashed" onClick={() => { setEditingId(null); setEditorOpen(true); }}>
              <Plus className="h-4 w-4" /> Add custom provider
            </Button>
          </section>

          {error && <p className="m-0 text-xs text-[var(--danger)]">{error}</p>}
          {!ready && <p className="m-0 text-xs text-[var(--warning)]">This popup stays open until a provider and model are set.</p>}
        </div>
      </Modal>

      {editorOpen && (
        <CustomProviderEditor
          existing={editingProvider}
          onClose={() => setEditorOpen(false)}
          onSaved={(created) => {
            selectCustomProvider(created.id);
            updateCustomProvider(created.id, {});
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
}

function CustomProviderEditor({
  existing,
  onClose,
  onSaved,
}: {
  existing?: CustomProvider;
  onClose: () => void;
  onSaved: (created: CustomProvider) => void;
}) {
  const addCustomProvider = useStore((s) => s.addCustomProvider);
  const updateCustomProvider = useStore((s) => s.updateCustomProvider);
  const [name, setName] = useState(existing?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [models, setModels] = useState<string[]>(existing?.models.length ? existing.models : [""]);
  const [headers, setHeaders] = useState<CustomHeader[]>(existing?.headers ?? []);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const cleanModels = models.map((m) => m.trim()).filter(Boolean);
    if (!name.trim()) return setError("A provider name is required.");
    if (!baseUrl.trim()) return setError("A base URL is required.");
    if (cleanModels.length === 0) return setError("Add at least one model.");
    const cleanHeaders = headers.filter((h) => h.key.trim()).map((h) => ({ key: h.key.trim(), value: h.value }));
    const url = baseUrl.trim().replace(/\/+$/, "");
    if (existing) {
      updateCustomProvider(existing.id, { name: name.trim(), baseUrl: url, apiKey, models: cleanModels, headers: cleanHeaders });
      onSaved(existing);
    } else {
      const created = addCustomProvider({ name: name.trim(), baseUrl: url, apiKey, models: cleanModels, headers: cleanHeaders });
      onSaved(created);
    }
  };

  return (
    <Modal open onClose={onClose} title={existing ? "Edit custom provider" : "Add custom provider"} size="md" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save}><Check className="h-4 w-4" /> {existing ? "Save & connect" : "Connect"}</Button></>}>
      <div className="space-y-4 p-5">
        <Field label="Provider name *">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="My Provider" />
        </Field>
        <Field label="Base URL *">
          <TextInput value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />
        </Field>
        <Field label="API key (optional)">
          <TextInput type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">Models *</div>
          <div className="space-y-2">
            {models.map((m, i) => (
              <div key={i} className="flex gap-2">
                <TextInput value={m} onChange={(e) => setModels((ms) => ms.map((x, xi) => (xi === i ? e.target.value : x)))} placeholder="model-id" className="font-mono" />
                <button onClick={() => setModels((ms) => (ms.length > 1 ? ms.filter((_, xi) => xi !== i) : ms))} disabled={models.length <= 1} className="shrink-0 text-[var(--subtle)] hover:text-[var(--danger)] disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setModels((ms) => [...ms, ""])}>
              <Plus className="h-3.5 w-3.5" /> Add model
            </Button>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-[var(--muted)]">Custom headers (optional)</div>
          <div className="space-y-2">
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2">
                <TextInput value={h.key} onChange={(e) => setHeaders((hs) => hs.map((x, xi) => (xi === i ? { ...x, key: e.target.value } : x)))} placeholder="Header" />
                <TextInput value={h.value} onChange={(e) => setHeaders((hs) => hs.map((x, xi) => (xi === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" />
                <button onClick={() => setHeaders((hs) => hs.filter((_, xi) => xi !== i))} className="shrink-0 text-[var(--subtle)] hover:text-[var(--danger)]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setHeaders((hs) => [...hs, { key: "", value: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add header
            </Button>
          </div>
        </div>
        {error && <p className="m-0 text-sm text-[var(--danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
