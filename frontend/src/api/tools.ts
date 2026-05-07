import { api } from "./client";

export const toolsApi = {
  list: () =>
    api
      .get<{ tools: Array<{ name: string; description: string; enabled: boolean; category: string }> }>("/tools/list")
      .then((r) => r.tools.map((t) => ({ ...t, id: t.name }))),
  execute: (tool: string, params: unknown) =>
    api.post<{ ok: boolean; result?: unknown; error?: string }>("/tools/execute", { tool, params }),
  enable: (tool: string) => api.post("/tools/enable", { tool }),
  disable: (tool: string) => api.post("/tools/disable", { tool }),
  globalToggle: (enabled: boolean) => api.post("/tools/global-toggle", { enabled }),
};
