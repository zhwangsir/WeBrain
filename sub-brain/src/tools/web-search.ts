/**
 * Web Search Tool — DuckDuckGo HTML 搜索（无需 API Key）
 * 基于 DuckDuckGo HTML 接口，绕过请求限制
 */

import { registry, ToolDefinition } from "./tool-registry.js";

const webSearchDef: ToolDefinition = {
  name: "web_search",
  description: "Search the web using DuckDuckGo. Returns top results with title, URL, and snippet.",
  category: "web",
  parameters: [
    { name: "query", type: "string", description: "Search query", required: true },
    { name: "count", type: "number", description: "Number of results (max 10)", default: 5 },
    { name: "region", type: "string", description: "Region code (e.g. zh-cn, en-us)", default: "zh-cn" },
  ],
};

async function webSearchExecute(params: Record<string, unknown>) {
  const query = String(params.query || "").trim();
  const count = Math.min(Math.max(Number(params.count || 5), 1), 10);
  const region = String(params.region || "zh-cn");

  if (!query) {
    return { error: "Query is required" };
  }

  // DuckDuckGo HTML search URL
  const searchUrl = new URL("https://html.duckduckgo.com/html/");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("kl", region);

  try {
    const resp = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!resp.ok) {
      return { error: `DuckDuckGo returned ${resp.status}` };
    }

    const html = await resp.text();
    const results = parseDuckDuckGoResults(html, count);

    return {
      query,
      result_count: results.length,
      results,
    };
  } catch (err: any) {
    return { error: `Search failed: ${err.message}` };
  }
}

function parseDuckDuckGoResults(html: string, maxResults: number): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // DuckDuckGo HTML result structure:
  // <div class="result">
  //   <h2 class="result__title"><a href="...">Title</a></h2>
  //   <a class="result__url" href="...">URL</a>
  //   <a class="result__snippet">Snippet...</a>
  // </div>

  const resultBlocks = html.split('class="result"');

  for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
    const block = resultBlocks[i];

    // Extract title
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*>(.*?)<\/a>/i) ||
                       block.match(/<h2[^>]*>.*?<a[^>]*>(.*?)<\/a>.*?<\/h2>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";

    // Extract URL
    const urlMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"/i) ||
                     block.match(/<a[^>]*href="([^"]+)"[^>]*class="result__a"/i);
    let url = urlMatch ? urlMatch[1] : "";
    // DuckDuckGo redirects via /l/?kh=...&uddg=URL
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }

    // Extract snippet
    const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/i);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";

    if (title && url) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ─── Registration ────────────────────────────────────────────────

export function registerWebSearchTool(): void {
  registry.register(webSearchDef, webSearchExecute);
}
