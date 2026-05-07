import { create } from "zustand";
import { message } from "antd";
import { toolsApi } from "../api/tools";
import type { Tool } from "../api/types";

interface ToolState {
  tools: Tool[];
  loading: boolean;
  globalEnabled: boolean;
  fetchTools: () => Promise<void>;
  toggleTool: (id: string, enabled: boolean) => Promise<void>;
  toggleGlobal: (enabled: boolean) => Promise<void>;
  executeTool: (id: string, params: unknown) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
}

export const useToolStore = create<ToolState>((set) => ({
  tools: [],
  loading: false,
  globalEnabled: true,

  fetchTools: async () => {
    set({ loading: true });
    try {
      const tools = await toolsApi.list();
      set({ tools: Array.isArray(tools) ? tools : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取工具列表失败");
      set({ loading: false });
    }
  },

  toggleTool: async (id, enabled) => {
    try {
      if (enabled) {
        await toolsApi.enable(id);
      } else {
        await toolsApi.disable(id);
      }
      set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, enabled } : t)) }));
    } catch (e: any) {
      message.error(e.message || "切换工具状态失败");
    }
  },

  toggleGlobal: async (enabled) => {
    try {
      await toolsApi.globalToggle(enabled);
      set({ globalEnabled: enabled });
    } catch (e: any) {
      message.error(e.message || "切换全局工具状态失败");
    }
  },

  executeTool: async (id, params) => {
    try {
      const res = await toolsApi.execute(id, params);
      return res;
    } catch (e: any) {
      message.error(e.message || "执行工具失败");
      return { ok: false, error: e.message || "执行失败" };
    }
  },
}));
