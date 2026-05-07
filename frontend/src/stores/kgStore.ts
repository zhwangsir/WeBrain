import { create } from "zustand";
import { message } from "antd";
import { kgApi } from "../api/kg";
import type { KgEntity, KgRelation } from "../api/types";

interface KgState {
  entities: KgEntity[];
  selectedEntity: KgEntity | null;
  entityRelations: KgRelation[];
  searchResults: any[];
  stats: any;
  loading: boolean;
  query: string;
  fetchEntities: (type?: string) => Promise<void>;
  selectEntity: (id: string) => Promise<void>;
  search: (q: string) => Promise<void>;
  addEntity: (data: { name: string; type?: string; description?: string }) => Promise<void>;
  addRelation: (data: { source_id: string; target_id: string; type: string }) => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useKgStore = create<KgState>((set) => ({
  entities: [],
  selectedEntity: null,
  entityRelations: [],
  searchResults: [],
  stats: null,
  loading: false,
  query: "",

  fetchEntities: async (type) => {
    set({ loading: true });
    try {
      const entities = await kgApi.listEntities(type);
      set({ entities: Array.isArray(entities) ? entities : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取实体失败");
      set({ loading: false });
    }
  },

  selectEntity: async (id) => {
    try {
      const res = await kgApi.getEntity(id);
      set({ selectedEntity: res.entity, entityRelations: Array.isArray(res.relations) ? res.relations : [] });
    } catch (e: any) {
      message.error(e.message || "获取实体详情失败");
    }
  },

  search: async (q) => {
    set({ loading: true, query: q });
    try {
      const results = await kgApi.search(q);
      set({ searchResults: results, loading: false });
    } catch (e: any) {
      message.error(e.message || "搜索实体失败");
      set({ loading: false });
    }
  },

  addEntity: async (data) => {
    set({ loading: true });
    try {
      await kgApi.addEntity(data);
      const entities = await kgApi.listEntities();
      set({ entities: Array.isArray(entities) ? entities : [], loading: false });
      message.success("实体已添加");
    } catch (e: any) {
      message.error(e.message || "添加实体失败");
      set({ loading: false });
    }
  },

  addRelation: async (data) => {
    try {
      await kgApi.addRelation(data);
      const res = await kgApi.getEntity(data.source_id);
      set({ entityRelations: Array.isArray(res.relations) ? res.relations : [] });
      message.success("关系已添加");
    } catch (e: any) {
      message.error(e.message || "添加关系失败");
    }
  },

  fetchStats: async () => {
    try {
      const stats = await kgApi.stats();
      set({ stats });
    } catch (e: any) {
      message.error(e.message || "获取统计失败");
    }
  },
}));
