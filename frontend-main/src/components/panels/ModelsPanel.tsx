import { useEffect, useMemo, useState } from "react";
import { Check, Cpu, Pencil, Plug, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { fetchModels, fetchProviders } from "@/lib/api";
import {
  FALLBACK_PROVIDERS,
  LMSTUDIO_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_BASE_URL,
  isCustomProviderId,
  isLocalProviderId,
} from "@/lib/providers";
import { EFFORT_PRESETS, type CustomHeader, type CustomProvider } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button, EmptyState, Field, PanelHeader, TextInput } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

/**
 * Models page.
 *
 * The single home for every AI model provider operation: search providers, select the
 * active provider, configure its API key / base URL, search and pick models, manage
 * custom OpenAI-compatible providers, and tune model behavior (reasoning effort +
 * temperature). Everything here writes through the same store slices the Settings
 * modal uses, so both surfaces stay in sync.
 */
export function ModelsPanel() {
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
  const selectCustomProvider = useStore((s) => s.selectCustomProvider);
  const deleteCustomProvider = useStore((s) => s.deleteCustomProvider);
  const updateCustomProvider = useStore((s) => s.updateCustomProvider);

  const [error, setError] = useState<string | null>(null);
  const [providerQuery, setProviderQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [effortCustom, setEffortCustom] = useState(false);

  // Load the live provider catalog once so the grid always reflects the backend.
  useEffect(() => {
    if (providers.length === 0) fetchProviders().then(setProviders).catch(() => {});
  }, [providers.length, setProviders]);

  // Reflect the stored effort: custom mode iff it's not one of the presets.
  const effort = settings.effort ?? "high";
  useEffect(() => {
    setEffortCustom(!(EFFORT_PRESETS as readonly string[]).includes(effort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const builtIns = providers.length > 0 ? providers : FALLBACK_PROVIDERS;
  const isCustom = isCustomProviderId(settings.provider);
  const selectedCustom = customProviders.find((p) => p.id === settings.provider);
  const editingProvider = customProviders.find((p) => p.id === editingId);
  const currentKey = isCustom ? (selectedCustom?.apiKey ?? "") : (settings.apiKeys[settings.provider] ?? "");
  const defaultBaseUrl = isCustom ? selectedCustom?.baseUrl : builtIns.find((p) => p.id === settings.provider)?.defaultBaseUrl;
  const modelOptions = isCustom ? (selectedCustom?.models ?? []).filter((m) => m.trim()) : models.map((m) => m.id);
  const isLocal = isLocalProviderId(settings.provider);

  const filteredProviders = useMemo(() => {
    const q = providerQuery.trim().toLowerCase();
    const all = [
      ...builtIns.map((p) => ({ id: p.id, label: p.label, custom: false as const })),
      ...customProviders.map((p) => ({ id: p.id, label: p.name || p.id, custom: true as const })),
    ];
    if (!q) return all;
    return all.filter((p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }, [builtIns, customProviders, providerQuery]);

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return modelOptions;
    return modelOptions.filter((m) => m.toLowerCase().includes(q));
  }, [modelOptions, modelQuery]);

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

  const temperature = typeof settings.temperature === "number" ? settings.temperature : 0.6;
  const activeProviderLabel = isCustom
    ? (selectedCustom?.name || "Custom provider")
    : (builtIns.find((p) => p.id === settings.provider)?.label ?? settings.provider);

  return (
    <div className="mx-auto w-full max-w-2xl panel-in">
      <PanelHeader kicker="Providers & models" title="Models" />
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        Search providers, pick the active one, configure its API key, then search and select a model.
        Custom OpenAI-compatible providers live here too.
      </p>

      <div
        className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] px-3 py-2 text-xs text-[var(--muted)]"
        aria-live="polite"
      >
        <Cpu className="h-3.5 w-3.5 shrink-0 text-[var(--subtle)]" />
        <span>
          Active:{" "}
          <span className="font-medium text-[var(--fg)]">
            {activeProviderLabel} · {settings.model || "no model selected"}
          </span>
        </span>
      </div>

      {/* Providers */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Providers</h3>
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
            <button
              type="button"
              onClick={() => setProviderQuery("")}
              aria-label="Clear provider search"
              className="text-[var(--subtle)] hover:text-[var(--fg)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {filteredProviders.length === 0 ? (
          <EmptyState icon={<Cpu className="h-8 w-8" />}>No providers match “{providerQuery}”.</EmptyState>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {filteredProviders.map((p) => {
              const active = settings.provider === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleProvider(p.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[var(--radius-lg)] border p-3 text-left transition-colors",
                      active
                        ? "border-[var(--secondary)] bg-[var(--chip)]"
                        : "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--secondary)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-md)]",
                        active ? "bg-[var(--secondary)] text-[var(--secondary-fg)]" : "bg-[var(--chip)] text-[var(--muted)]",
                      )}
                    >
                      <Cpu className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--fg)]">{p.label}</span>
                      <span className="block truncate font-mono text-[10px] text-[var(--subtle)]">
                        {p.custom ? "custom provider" : p.id}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 shrink-0 text-[var(--secondary)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Connection */}
      <section className="mt-6 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Connection</h3>
        {isCustom ? (
          <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-3">
            <p className="text-xs text-[var(--muted)]">Connected to {selectedCustom?.baseUrl || "no base URL"}</p>
            {selectedCustom && (
              <button
                onClick={() => { setEditingId(selectedCustom.id); setEditorOpen(true); }}
                className="text-xs font-medium text-[var(--secondary)] hover:underline"
              >
                Edit provider or its models
              </button>
            )}
          </div>
        ) : (
          <>
            {isLocal && (
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--chip)] p-3 text-xs leading-relaxed text-[var(--muted)]">
                Use models running on your own computer — no API key needed. Start Ollama
                (`ollama serve`, then `ollama pull llama3.1`) or LM Studio (start its local
                server), then Load models or type the model id below.
              </div>
            )}
            <Field label={isLocal ? `API key (${settings.provider}, optional)` : `API key (${settings.provider})`}>
              <TextInput
                type="password"
                value={currentKey}
                onChange={(e) => setApiKey(settings.provider, e.target.value)}
                placeholder={isLocal ? "Not needed for local servers" : "sk-…"}
              />
            </Field>
            <Field label={isLocal ? "Server URL (Ollama / LM Studio / any local server)" : "Base URL (optional override)"}>
              <TextInput
                value={settings.baseUrl}
                onChange={(e) => setSettings({ baseUrl: e.target.value })}
                placeholder={defaultBaseUrl ? `Default: ${defaultBaseUrl}` : "https://…/v1"}
              />
              {isLocal && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSettings({ baseUrl: OLLAMA_DEFAULT_BASE_URL })}
                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg)] hover:border-[var(--secondary)]"
                  >
                    Ollama · localhost:11434
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ baseUrl: LMSTUDIO_DEFAULT_BASE_URL })}
                    className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--fg)] hover:border-[var(--secondary)]"
                  >
                    LM Studio · localhost:1234
                  </button>
                </div>
              )}
            </Field>
          </>
        )}
      </section>

      {/* Models */}
      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">
            Models {modelOptions.length > 0 && <span className="text-[var(--subtle)]">({modelOptions.length})</span>}
          </h3>
          {!isCustom && (
            <button
              type="button"
              onClick={loadModels}
              disabled={modelsLoading}
              className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--muted)] hover:border-[var(--secondary)] disabled:opacity-50"
              title="Load the available models from the provider"
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
            <button
              type="button"
              onClick={() => setModelQuery("")}
              aria-label="Clear model search"
              className="text-[var(--subtle)] hover:text-[var(--fg)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isCustom && modelOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {filteredModels.map((m) => (
              <button
                key={m}
                onClick={() => setSettings({ model: m })}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  settings.model === m
                    ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-fg)]"
                    : "border-[var(--border)] text-[var(--fg)] hover:border-[var(--secondary)]",
                )}
              >
                {m}
              </button>
            ))}
            {filteredModels.length === 0 && (
              <p className="w-full px-1 py-2 text-center text-xs text-[var(--subtle)]">No matching models.</p>
            )}
          </div>
        ) : !isCustom ? (
          <div className="max-h-64 space-y-0.5 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] p-2">
            {filteredModels.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-[var(--subtle)]">
                {modelOptions.length === 0 ? "No models loaded — press Load models." : "No matching models."}
              </p>
            ) : (
              filteredModels.map((m) => {
                const active = settings.model === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSettings({ model: m })}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left hover:bg-[var(--chip)]",
                      active && "bg-[var(--chip)]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--fg)]">{m}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--secondary)]" />}
                  </button>
                );
              })
            )}
          </div>
        ) : null}

        <Field label={isCustom && modelOptions.length === 0 ? "Model (type an id)" : "Or type a model id manually"}>
          <TextInput
            value={settings.model}
            onChange={(e) => setSettings({ model: e.target.value })}
            placeholder={isCustom ? "No models yet — add one below" : "e.g. gpt-4o-mini"}
            className="font-mono text-xs"
          />
        </Field>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </section>

      {/* Model behavior */}
      <section className="mt-6 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Model behavior</h3>
        <Field label="Reasoning effort">
          <div className="flex flex-wrap items-center gap-1.5">
            {EFFORT_PRESETS.map((level) => {
              const active = !effortCustom && effort === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => { setEffortCustom(false); setSettings({ effort: level }); }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                    active
                      ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-fg)]"
                      : "border-[var(--border)] text-[var(--fg)] hover:border-[var(--secondary)]",
                  )}
                >
                  {level}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setEffortCustom(true)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                effortCustom
                  ? "border-[var(--secondary)] bg-[var(--secondary)] text-[var(--secondary-fg)]"
                  : "border-[var(--border)] text-[var(--fg)] hover:border-[var(--secondary)]",
              )}
            >
              Custom
            </button>
          </div>
        </Field>
        {effortCustom && (
          <TextInput
            value={effort}
            onChange={(e) => setSettings({ effort: e.target.value })}
            placeholder="Custom effort (e.g. minimal, xhigh) — passed to the model"
            className="font-mono text-xs"
          />
        )}
        <Field label="Temperature" hint={temperature.toFixed(2)}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setSettings({ temperature: clampTemp(Number(e.target.value)) })}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border)] accent-[var(--secondary)]"
            />
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={temperature}
              onChange={(e) => setSettings({ temperature: clampTemp(Number(e.target.value)) })}
              className="w-20 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm text-[var(--fg)] outline-none focus:border-[var(--secondary)]"
            />
          </div>
        </Field>
      </section>

      {/* Custom providers */}
      <section className="mt-6 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Custom providers</h3>
        {customProviders.length > 0 && (
          <ul className="space-y-2">
            {customProviders.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--fg)]">
                    {p.name || p.id}
                    {settings.provider === p.id && (
                      <span className="ml-2 rounded-full bg-[var(--secondary)] px-1.5 py-0.5 text-[10px] text-[var(--secondary-fg)]">Active</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-[var(--subtle)]">
                    {p.baseUrl || "no base URL"} · {p.models.filter((m) => m.trim()).length} model(s)
                  </p>
                </div>
                <button
                  onClick={() => selectCustomProvider(p.id)}
                  title="Set active"
                  className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--subtle)] hover:bg-[var(--chip)] hover:text-[var(--fg)]"
                >
                  <Plug className="h-4 w-4" />
                </button>
                <button
                  onClick={() => { setEditingId(p.id); setEditorOpen(true); }}
                  title="Edit"
                  className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--subtle)] hover:bg-[var(--chip)] hover:text-[var(--fg)]"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteCustomProvider(p.id)}
                  title="Delete"
                  className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] text-[var(--subtle)] hover:text-[var(--danger)]"
                >
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
    </div>
  );
}

/** Clamp an untrusted temperature to the provider-safe 0–2 range (NaN → 0.6 default). */
function clampTemp(value: number): number {
  if (!Number.isFinite(value)) return 0.6;
  return Math.min(2, Math.max(0, Math.round(value * 100) / 100));
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
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setHeaders((hs) => [...hs, { key: "", value: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add header
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </div>
    </Modal>
  );
}
