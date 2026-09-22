/** A single streamed delta from the provider. */
export interface StreamDelta {
  text?: string;
  reasoning?: string;
  toolCalls?: ToolCallDelta[];
  finishReason?: string | null;
}

/** Incremental tool-call fragment as emitted by OpenAI-style streaming. */
export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

/** Fully-formed tool call after merging deltas. */
export interface ToolCall {
  id: string | null;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ModelPricing {
  /** Price per 1M prompt tokens (in USD when known). Null when unknown. */
  prompt?: number | null;
  /** Price per 1M completion tokens (in USD when known). Null when unknown. */
  completion?: number | null;
  /** Currency of the prices above (defaults to "USD" when prices are present). */
  currency?: string | null;
  /** Unit the prices are quoted in (defaults to "1M tokens"). */
  unit?: string | null;
}

export interface ProviderModel {
  id: string;
  provider: string;
  label: string;
  owned_by?: string | null;
  context_window?: number | null;
  /** Max output/completion tokens when the provider advertises it. Null when unknown. */
  max_output_tokens?: number | null;
  /** Per-1M-token pricing when the provider advertises it. Null when unsupported. */
  pricing?: ModelPricing | null;
  /** Short human description when the provider supplies one. Null when unknown. */
  description?: string | null;
  /** Capability tags (e.g. "tools", "vision", "reasoning") when derivable. Null when unknown. */
  capabilities?: string[] | null;
}

export interface ProviderMetadata {
  id: string;
  label: string;
  defaultBaseUrl: string;
  /** Extra headers appended on every request (e.g. attribution headers). */
  extraHeaders?: Record<string, string>;
}

export interface ChatCompletionOptions {
  apiKey: string;
  model: string;
  messages: Array<Record<string, unknown>>;
  tools: unknown[];
  baseUrl?: string;
  /**
   * Sampling temperature forwarded to the provider. When omitted the provider
   * falls back to a sensible default. Models that don't support custom
   * temperatures simply ignore (or clamp) the value.
   */
  temperature?: number;
  /**
   * Reasoning effort: one of the presets (`low` | `medium` | `high` | `max`) or
   * a custom string the model understands. Applied as `reasoning_effort` (or the
   * provider's equivalent). Omitted/empty means "use the provider default", and
   * models without reasoning support ignore it.
   */
  effort?: string;
  signal?: AbortSignal;
}

/** Common interface implemented by every provider. */
export interface Provider {
  readonly metadata: ProviderMetadata;
  listModels(apiKey: string, baseUrl?: string): Promise<ProviderModel[]>;
  streamChatCompletion(options: ChatCompletionOptions): AsyncGenerator<StreamDelta, void, unknown>;
}
