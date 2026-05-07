import { api } from "./client";
import type { ModelConfig } from "./types";

export interface GlobalConfig {
  version: string;
  debug: boolean;
  logLevel: string;
  maxConcurrentTools: number;
  toolTimeoutMs: number;
  requireConfirmation: boolean;
  whitelistMode: "strict" | "permissive";
  defaultWorkspace: string;
}

export const configApi = {
  getModel: () => api.get<ModelConfig>("/config/model"),
  setModel: (config: Partial<ModelConfig>) => api.post("/config/model", config),
  detectModel: () => api.post<{ ok: boolean; message: string; details?: any }>("/config/model/detect"),
  resetModel: () => api.post<{ ok: boolean; config: ModelConfig }>("/config/model/reset"),
  getGlobal: () => api.get<GlobalConfig>("/config/global"),
  setGlobal: (config: Partial<GlobalConfig>) => api.post("/config/global", config),
  health: () => api.get<{ endpoints: any[] }>("/health/models"),
};
