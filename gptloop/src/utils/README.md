# Utility Layer (`gptloop/src/utils`)

The `utils` directory provides low-level helper functions and security boundaries for GPTLoop's backend runtime.

---

## 🎯 Utility Modules Overview

```
gptloop/src/utils/
├── paths.ts                  # Workspace path sandboxing & security validation
├── sse.ts                    # Server-Sent Events formatting & HTTP stream writing
├── mime.ts                   # File extension to MIME type lookup table
├── vision.ts                 # Vision model detection heuristics & overrides
└── json.ts                   # Safe JSON parsing & schema normalization helpers
```

---

## 🧩 Key Utility Functions

### 1. Path Sandboxing (`paths.ts`)
Secures all agent file system operations:
- `assertInWorkspace(filePath, workspaceRoot)`: Verifies that resolved file paths remain strictly inside `WORKSPACE_ROOT`. Throws an error if path traversal (`../`) attempts to escape the workspace boundary.
- `relativeToWorkspace(filePath, workspaceRoot)`: Normalizes absolute workspace paths to clean relative paths for tool outputs and logs.

### 2. Vision Model Detection (`vision.ts`)
Determines whether an LLM model supports visual image inputs (for `read_image` tool calls):
- Checks model ID against known vision patterns (`gpt-4o`, `claude-3-5`, `llava`, `gemini-1.5`, etc.).
- Evaluates `VISION_MODEL_PATTERNS` and `TEXT_ONLY_MODEL_PATTERNS` environment variable overrides.

### 3. SSE Stream Formatting (`sse.ts`)
Standardizes Server-Sent Event formatting (`data: ...\n\n`) for streaming chat execution events to HTTP response streams.

### 4. MIME Type Lookup (`mime.ts`)
Maps file extensions (`.ts`, `.json`, `.png`, `.svg`, `.html`, etc.) to standard Content-Type MIME strings for file reading and image serving endpoints.

### 5. Safe JSON Normalization (`json.ts`)
Safely parses JSON strings and normalizes tool argument schemas, preventing runtime crashes from malformed model tool outputs.
