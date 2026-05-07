import { create } from "zustand";
import { message } from "antd";
import { configApi } from "../api/config";
import type { ModelConfig, GlobalConfig } from "../api/types";

interface ConfigState {
  modelConfig: ModelConfig | null;
  globalConfig: GlobalConfig | null;
  loading: boolean;
  detecting: boolean;
  detectResult: { ok: boolean; message: string; details?: any } | null;

  fetchModelConfig: () => Promise<void>;
  saveModelConfig: (config: Partial<ModelConfig>) => Promise<void>;
  detectModel: () => Promise<void>;
  resetModel: () => Promise<void>;
  fetchGlobalConfig: () => Promise<void>;
  saveGlobalConfig: (config: Partial<GlobalConfig>) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  modelConfig: null,
  globalConfig: null,
  loading: false,
  detecting: false,
  detectResult: null,

  fetchModelConfig: async () => {
    set({ loading: true });
    try {
      const config = await configApi.getModel();
      set({ modelConfig: config, loading: false });
    } catch (e: any) {
      message.error(e.message || "获取模型配置失败");
      set({ loading: false });
    }
  },

  saveModelConfig: async (config) => {
    set({ loading: true });
    try {
      await configApi.setModel(config);
      set((s) => ({ modelConfig: s.modelConfig ? { ...s.modelConfig, ...config } : null, loading: false }));
      message.success("模型配置已保存");
    } catch (e: any) {
      message.error(e.message || "保存模型配置失败");
      set({ loading: false });
    }
  },

  detectModel: async () => {
    set({ detecting: true, detectResult: null });
    try {
      const result = await configApi.detectModel();
      set({ detectResult: result, detecting: false });
    } catch (e: any) {
      message.error(e.message || "模型检测失败");
      set({ detecting: false });
    }
  },

  resetModel: async () => {
    set({ loading: true });
    try {
      const { config } = await configApi.resetModel();
      set({ modelConfig: config, loading: false });
      message.success("已重置为默认配置");
    } catch (e: any) {
      message.error(e.message || "重置配置失败");
      set({ loading: false });
    }
  },

  fetchGlobalConfig: async () => {
    set({ loading: true });
    try {
      const config = await configApi.getGlobal();
      set({ globalConfig: config, loading: false });
    } catch (e: any) {
      message.error(e.message || "获取通用配置失败");
      set({ loading: false });
    }
  },

  saveGlobalConfig: async (config) => {
    set({ loading: true });
    try {
      await configApi.setGlobal(config);
      set((s) => ({ globalConfig: s.globalConfig ? { ...s.globalConfig, ...config } : null, loading: false }));
      message.success("通用配置已保存");
    } catch (e: any) {
      message.error(e.message || "保存通用配置失败");
      set({ loading: false });
    }
  },
}));
