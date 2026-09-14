# LLM Provider Registry (`gptloop/src/agents/providers`)

The `providers` directory provides a unified multi-provider abstraction layer for GPTLoop. It manages API credentials, model discovery, request formatting, tool call serialization, and reasoning extraction across 30+ LLM providers.

---

## 🎯 Supported LLM Providers

GPTLoop integrates with a wide variety of cloud and local LLM services:

- **OpenAI & Anthropic Compatible:** Direct API connections or proxied gateways.
- **OpenRouter:** Access to hundreds of models via OpenRouter routing (`openrouter.ts`).
- **Ollama Cloud & Local:** Ollama models (`ollamaCloud.ts`).
- **Groq:** Ultra-fast inference with Groq LPU models (`groq.ts`).
- **DeepSeek:** Native DeepSeek AI models including DeepSeek-R1 (`deepseek.ts`).
- **Cerebras:** High-speed Cerebras inference (`cerebras.ts`).
- **Fireworks AI & Cohere:** High-performance model hosting (`fireworks.ts`, `cohere.ts`).
- **HuggingFace, Mistral & NVIDIA NIM:** Cloud endpoints (`huggingface.ts`, `mistral.ts`, `nvidia.ts`).
- **Custom / OpenAI-Compatible Endpoints:** User-configurable custom API base URLs and keys (`custom.ts`).
- **Additional Aggregators & Gateways:** AIHubMix, Airforce, Apinex, BlueClaw, Chutes, InceptionLabs, KiloCode, OpenAdapter, OpenCodeZen, OpenTyphoon, Pollinations, Requesty, RouteWay, SambaNova, Sarvam, SeaLion, SiliconFlow, UnoRouter, Vercel AI Gateway, XKiro, ZAI, ZenMux.

---

## 🧠 Reasoning & Thinking Model Support

Models that produce explicit step-by-step thinking traces (such as DeepSeek-R1 or Qwen reasoning models) output reasoning wrapped in `<think>...</think>` tags.

The reasoning parser (`reasoning.ts`):
1. Detects and extracts reasoning text from the model's output stream.
2. Emits real-time reasoning events to the frontend UI for live visual inspection.
3. Cleans the final content stream so tool call parsing and text outputs remain clean and structured.

---

## ⚙️ Configuration & Key Management

API keys and custom endpoints can be configured:
1. **In Environment Variables:** Set provider keys (e.g. `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`) in `gptloop/.env`.
2. **In the UI Settings Modal:** Pass client-side keys dynamically per chat request from the browser interface without restarting the backend.

> 🔒 **Security Note:** Real API keys are never stored in source code or logged in state databases.
