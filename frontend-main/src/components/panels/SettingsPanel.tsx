import { useEffect, useState } from "react";
import { Plug } from "lucide-react";
import { useStore } from "@/store/useStore";
import { validateComposioKey } from "@/lib/connectors";
import { EFFORT_PRESETS } from "@/types";
import { Button, Field, PanelHeader, Select, TextInput } from "@/components/ui/primitives";
import { cn } from "@/utils/cn";

/** Clamp an untrusted temperature to the provider-safe 0–2 range (NaN → 0.6 default). */
function clampTemp(value: number): number {
  if (!Number.isFinite(value)) return 0.6;
  return Math.min(2, Math.max(0, Math.round(value * 100) / 100));
}

/**
 * Settings page.
 *
 * Everything that is NOT part of the Quick start popup: model behavior,
 * web search/fetch, sub-agent sessions, memory agent, agent teams, CEO mode,
 * and app-connector keys. Provider + model setup stays in Quick start only.
 */
export function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setSearchProvider = useStore((s) => s.setSearchProvider);
  const setFetchProvider = useStore((s) => s.setFetchProvider);
  const setSearchApiKey = useStore((s) => s.setSearchApiKey);

  const [effortCustom, setEffortCustom] = useState(false);
  const [composioCheck, setComposioCheck] = useState<"ok" | "bad" | null>(null);
  const [composioChecking, setComposioChecking] = useState(false);

  const effort = settings.effort ?? "high";
  const temperature = typeof settings.temperature === "number" ? settings.temperature : 0.6;
  const effortIsPreset = (EFFORT_PRESETS as readonly string[]).includes(effort);

  useEffect(() => {
    setEffortCustom(!effortIsPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paidSearch = settings.searchProvider !== "duckduckgo";

  return (
    <div className="mx-auto w-full max-w-2xl panel-in">
      <PanelHeader kicker="Preferences" title="Settings" />
      <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">
        Tune how the agent behaves. Model connection stays in Quick start.
      </p>

      <div className="space-y-6">
        {/* Model behavior */}
        <section className="space-y-4 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
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
              placeholder="Custom effort (e.g. minimal, xhigh)"
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

        {/* Web search */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Web search</h3>
          <Field label="Search provider">
            <Select value={settings.searchProvider} onChange={(e) => setSearchProvider(e.target.value as never)}>
              <option value="duckduckgo">DuckDuckGo (free)</option>
              <option value="tavily">Tavily</option>
              <option value="exa">Exa</option>
              <option value="serpapi">SerpAPI</option>
            </Select>
          </Field>
          {paidSearch && (
            <div className="grid gap-3">
              <Field label="Tavily API key">
                <TextInput type="password" value={settings.tavilyApiKey} onChange={(e) => setSearchApiKey("tavily", e.target.value)} placeholder="tvly-…" />
              </Field>
              <Field label="Exa API key">
                <TextInput type="password" value={settings.exaApiKey} onChange={(e) => setSearchApiKey("exa", e.target.value)} placeholder="exa-…" />
              </Field>
              <Field label="SerpAPI key">
                <TextInput type="password" value={settings.serpapiApiKey} onChange={(e) => setSearchApiKey("serpapi", e.target.value)} placeholder="SerpAPI key" />
              </Field>
            </div>
          )}
        </section>

        {/* Web fetch */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Web fetch</h3>
          <Field label="Fetch provider">
            <Select value={settings.fetchProvider} onChange={(e) => setFetchProvider(e.target.value as never)}>
              <option value="builtin">Built-in scraper (free)</option>
              <option value="firecrawl">Firecrawl</option>
            </Select>
          </Field>
          {settings.fetchProvider === "firecrawl" && (
            <Field label="Firecrawl API key">
              <TextInput type="password" value={settings.firecrawlApiKey} onChange={(e) => setSearchApiKey("firecrawl", e.target.value)} placeholder="fc-…" />
            </Field>
          )}
        </section>

        {/* Sub-agent sessions */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Sub-agent sessions</h3>
          <Field label="Reuse sub-agent sessions">
            <Select
              value={settings.enableReuseSubAgentSession ?? "no"}
              onChange={(e) => setSettings({ enableReuseSubAgentSession: e.target.value === "yes" ? "yes" : "no" })}
            >
              <option value="no">No — disabled</option>
              <option value="yes">Yes — enabled</option>
            </Select>
          </Field>
          <p className="m-0 text-xs text-[var(--muted)]">
            When enabled, the agent can continue previously run sub-agent sessions with their preserved context.
          </p>
        </section>

        {/* Memory agent */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Memory agent</h3>
          <Field label="Memory agent">
            <Select
              value={settings.memoryAgentEnabled ?? "yes"}
              onChange={(e) => setSettings({ memoryAgentEnabled: e.target.value === "yes" ? "yes" : "no" })}
            >
              <option value="yes">On — build memory (default)</option>
              <option value="no">Off — never build memory</option>
            </Select>
          </Field>
          <Field label="Build memory after every N tasks" hint="default 3">
            <TextInput
              type="number"
              min={1}
              max={50}
              value={settings.memoryAgentInterval ?? 3}
              onChange={(e) => {
                const n = Number(e.target.value);
                setSettings({
                  memoryAgentInterval: Number.isFinite(n) ? Math.min(50, Math.max(1, Math.floor(n))) : 3,
                });
              }}
              placeholder="3"
            />
          </Field>
        </section>

        {/* Agent teams */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">Agent teams (multi-agent)</h3>
          <Field label="Enable agent teams">
            <Select
              value={settings.enableAgentTeams ?? "no"}
              onChange={(e) => setSettings({ enableAgentTeams: e.target.value === "yes" ? "yes" : "no" })}
            >
              <option value="no">No — single agent (default)</option>
              <option value="yes">Yes — use the active agent team</option>
            </Select>
          </Field>
          <Field label="Agent-to-agent messaging (send_message_to_team)">
            <Select
              value={settings.enableSendMessageToTeam ?? "no"}
              onChange={(e) => setSettings({ enableSendMessageToTeam: e.target.value === "yes" ? "yes" : "no" })}
            >
              <option value="no">No — disabled (default)</option>
              <option value="yes">Yes — members can message each other</option>
            </Select>
          </Field>
        </section>

        {/* CEO */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">CEO agent (multi-team)</h3>
          <Field label="Enable CEO agent">
            <Select
              value={settings.enableCeoAgents ?? "no"}
              onChange={(e) => setSettings({ enableCeoAgents: e.target.value === "yes" ? "yes" : "no" })}
            >
              <option value="no">No (default)</option>
              <option value="yes">Yes — use the active CEO agent</option>
            </Select>
          </Field>
        </section>

        {/* Connectors */}
        <section className="space-y-3 rounded-[var(--radius-xl)] bg-[var(--bg)] p-5" style={{ boxShadow: "var(--shadow-chip)" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--subtle)]">App connectors (Composio)</h3>
          <Field label="Composio API key">
            <div className="flex gap-2">
              <TextInput
                type="password"
                value={settings.composioApiKey ?? ""}
                onChange={(e) => { setSettings({ composioApiKey: e.target.value }); setComposioCheck(null); }}
                placeholder="ak-…"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={async () => {
                  setComposioChecking(true);
                  const ok = await validateComposioKey(settings.composioApiKey || undefined);
                  setComposioCheck(ok ? "ok" : "bad");
                  setComposioChecking(false);
                }}
                disabled={composioChecking || !(settings.composioApiKey ?? "").trim()}
              >
                <Plug className={cn("h-4 w-4", composioChecking && "animate-spin")} />
                {composioCheck === "ok" ? "Valid" : "Test"}
              </Button>
            </div>
          </Field>
          {composioCheck === "bad" && (
            <p className="m-0 text-xs text-[var(--danger)]">That key was rejected by Composio.</p>
          )}
          <p className="m-0 text-xs text-[var(--muted)]">
            Powers the Connectors page (GitHub, Slack, Notion, Gmail, Outlook). Get a key at{" "}
            <a href="https://app.composio.dev" target="_blank" rel="noreferrer" className="text-[var(--secondary)] hover:underline">
              app.composio.dev
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
