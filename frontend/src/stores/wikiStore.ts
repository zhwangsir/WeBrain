import { create } from "zustand";
import { message } from "antd";
import { wikiApi } from "../api/wiki";
import type { WikiNote } from "../api/types";

interface WikiState {
  notes: WikiNote[];
  searchResults: WikiNote[];
  stats: Record<string, any> | null;
  loading: boolean;
  query: string;
  fetchNotes: (tag?: string) => Promise<void>;
  search: (q: string) => Promise<void>;
  createNote: (data: Partial<WikiNote>) => Promise<void>;
  updateNote: (id: string, data: Partial<WikiNote>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useWikiStore = create<WikiState>((set) => ({
  notes: [],
  searchResults: [],
  stats: null,
  loading: false,
  query: "",

  fetchNotes: async (tag) => {
    set({ loading: true });
    try {
      const notes = await wikiApi.list(tag);
      set({ notes: Array.isArray(notes) ? notes : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取笔记失败");
      set({ loading: false });
    }
  },

  search: async (q) => {
    set({ loading: true, query: q });
    try {
      const results = await wikiApi.search(q);
      set({ searchResults: results, loading: false });
    } catch (e: any) {
      message.error(e.message || "搜索笔记失败");
      set({ loading: false });
    }
  },

  createNote: async (data) => {
    set({ loading: true });
    try {
      const note = await wikiApi.create(data);
      set((s) => ({ notes: [note, ...s.notes], loading: false }));
      message.success("笔记已创建");
    } catch (e: any) {
      message.error(e.message || "创建笔记失败");
      set({ loading: false });
    }
  },

  updateNote: async (id, data) => {
    set({ loading: true });
    try {
      const note = await wikiApi.update(id, data);
      set((s) => ({
        notes: s.notes.map((n) => (n.id === id ? note : n)),
        loading: false,
      }));
      message.success("笔记已更新");
    } catch (e: any) {
      message.error(e.message || "更新笔记失败");
      set({ loading: false });
    }
  },

  deleteNote: async (id) => {
    try {
      await wikiApi.delete(id);
      set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
      message.success("笔记已删除");
    } catch (e: any) {
      message.error(e.message || "删除笔记失败");
    }
  },

  fetchStats: async () => {
    try {
      const stats = await wikiApi.stats();
      set({ stats });
    } catch (e: any) {
      message.error(e.message || "获取统计失败");
    }
  },
}));
