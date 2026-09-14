# Web Scraper & Crawler (`gptloop/src/scraper`)

The `scraper` directory provides high-performance HTML parsing, web page fetching, content extraction, and multi-page web crawling for GPTLoop.

---

## 🎯 Purpose & Capabilities

When agents need external technical context, API documentation, or blog posts, the web scraper fetches and transforms raw HTML pages into clean Markdown or plain text.

### Capabilities:
- **Free Keyless HTML Scraper:** Converts raw HTML documents into structured Markdown (`html.ts` & `parser.ts`).
- **Extractor Modules (`extractors/`):** Extracts page title/description metadata, plain text content, structured links, and image URLs.
- **Recursive Web Crawler (`crawler.ts`):** Crawls internal site links up to a specified depth and link limit while skipping duplicate, mailto, and fragment links.
- **Firecrawl Integration:** Supports optional Firecrawl API integration (`FETCH_PROVIDER=firecrawl`) for advanced JS-rendered scraping.

---

## 🛠️ How It Integrates with Agents

The scraper powers the `fatch_web_urls` tool and the `/api/scrape` endpoint:

1. **Single Page Fetching:** Agent calls `fatch_web_urls` with a list of URLs. The scraper fetches the pages, extracts clean Markdown, and returns readable content to the agent.
2. **Crawl Mode:** When enabled, the crawler traverses internal site navigation to collect documentation across multiple linked pages.
3. **Fallback System:** If no Firecrawl API key is present, GPTLoop automatically defaults to the free built-in scraper without throwing errors.

---

## ⚙️ Configuration

Configured via environment variables or UI settings:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `FETCH_PROVIDER` | Default scraper engine (`builtin` or `firecrawl`) | `builtin` |
| `FIRECRAWL_API_KEY` | Optional API key for Firecrawl scraper | `""` |

---

## ⚠️ Limitations

- **JavaScript Execution:** The free built-in scraper fetches raw HTTP responses and parses static HTML. Client-side Single Page Applications (SPAs) that require heavy JavaScript rendering may produce minimal HTML text (use Firecrawl or search tools for SPA rendering).
- **Link Normalization:** Mailto links, `javascript:` pseudolinks, and URL fragment anchors are automatically filtered out.
