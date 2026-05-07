import { api } from "./client";
import type { Tool } from "./types";

export const toolsApi = {
  list: () =>
    api
      .get<{ tools: Omit<Tool, "id">[] }>("/tools/list")
      .then((r) => r.tools.map((t) => ({ ...t, id: t.name } as Tool))),
  execute: (tool: string, params: unknown) =>
    api.post<{ ok: boolean; result?: unknown; error?: string }>("/tools/execute", { tool, params }),
  enable: (tool: string) => api.post("/tools/enable", { tool }),
  disable: (tool: string) => api.post("/tools/disable", { tool }),
  globalToggle: (enabled: boolean) => api.post("/tools/global-toggle", { enabled }),
};
