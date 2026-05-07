import { create } from "zustand";
import { message } from "antd";
import { memoryApi } from "../api/memory";
import type { Memory } from "../api/types";

interface MemoryState {
  memories: Memory[];
  query: string;
  loading: boolean;
  fetchMemories: () => Promise<void>;
  search: (query: string) => Promise<void>;
  store: (content: string, level?: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  query: "",
  loading: false,

  fetchMemories: async () => {
    set({ loading: true });
    try {
      const memories = await memoryApi.list();
      set({ memories: Array.isArray(memories) ? memories : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取记忆失败");
      set({ loading: false });
    }
  },

  search: async (query) => {
    set({ loading: true, query });
    try {
      const memories = await memoryApi.search(query);
      set({ memories: Array.isArray(memories) ? memories : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "搜索记忆失败");
      set({ loading: false });
    }
  },

  store: async (content, level = "L1") => {
    try {
      await memoryApi.store({ content, level: level as "L1" | "L2" | "L3" | "L4" });
      message.success("记忆已存储");
    } catch (e: any) {
      message.error(e.message || "存储记忆失败");
    }
  },
}));
