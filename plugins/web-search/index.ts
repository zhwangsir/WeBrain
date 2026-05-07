/**
 * Web Search Plugin — WeBrain Plugin SDK v1 Example
 */

import type { PluginContext, ToolDefinition } from "../../sub-brain/src/plugin-sdk/types.js";

const tools: ToolDefinition[] = [
  {
    name: "web_search",
    description: "Search the web using DuckDuckGo",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", default: 5 },
      },
      required: ["query"],
    },
    runtime: "sub-brain",
    async handler(args, ctx) {
      const query = args.query;
      const maxResults = args.maxResults || 5;
      ctx.logger.info(`Searching: ${query}`);

      try {
        const axios = (await import("axios")).default;
        const resp = await axios.get(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
          { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 15000 }
        );
        // Simple regex extraction
        const results: any[] = [];
        const regex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g;
        let match;
        while ((match = regex.exec(resp.data)) && results.length < maxResults) {
          results.push({ title: match[2].replace(/<[^>]+>/g, ""), url: match[1] });
        }
        return { results };
      } catch (e: any) {
        ctx.logger.error("Search failed:", e.message);
        return { error: e.message };
      }
    },
  },
];

export default {
  async onLoad(ctx: PluginContext) {
    ctx.logger.info("Web Search plugin loaded");
    for (const tool of tools) {
      ctx.tools.register(tool);
    }
  },
  async onUnload(ctx: PluginContext) {
    ctx.logger.info("Web Search plugin unloaded");
  },
  tools,
};
