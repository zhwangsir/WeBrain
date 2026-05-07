import { api } from "./client";
import type { Agent } from "./types";

export const agentsApi = {
  list: () => api.get<{ agents: Agent[] }>("/api/agents").then((r) => r.agents),
  get: (id: string) => api.get<Agent>(`/api/agents/${id}`),
  create: (data: Partial<Agent>) => api.post<Agent>("/api/agents", data),
  update: (id: string, data: Partial<Agent>) => api.put<Agent>(`/api/agents/${id}`, data),
  delete: (id: string) => api.delete(`/api/agents/${id}`),
  run: (id: string, input: string) => api.post<{ result: string }>(`/api/agents/${id}/run`, { input }),
};
