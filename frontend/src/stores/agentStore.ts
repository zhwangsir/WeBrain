import { create } from "zustand";
import { message } from "antd";
import { agentsApi } from "../api/agents";
import type { Agent } from "../api/types";

interface AgentState {
  agents: Agent[];
  selectedAgent: Agent | null;
  loading: boolean;

  fetchAgents: () => Promise<void>;
  selectAgent: (id: string) => void;
  createAgent: (data: Partial<Agent>) => Promise<void>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  runAgent: (id: string, input: string) => Promise<string>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await agentsApi.list();
      set({ agents: Array.isArray(agents) ? agents : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取智能体失败");
      set({ loading: false });
    }
  },

  selectAgent: (id) => {
    const agent = get().agents.find((a) => a.id === id) || null;
    set({ selectedAgent: agent });
  },

  createAgent: async (data) => {
    set({ loading: true });
    try {
      const agent = await agentsApi.create(data);
      set((s) => ({ agents: [...s.agents, agent], loading: false }));
      message.success("智能体已创建");
    } catch (e: any) {
      message.error(e.message || "创建智能体失败");
      set({ loading: false });
    }
  },

  updateAgent: async (id, data) => {
    set({ loading: true });
    try {
      const agent = await agentsApi.update(id, data);
      set((s) => ({
        agents: s.agents.map((a) => (a.id === id ? agent : a)),
        selectedAgent: s.selectedAgent?.id === id ? agent : s.selectedAgent,
        loading: false,
      }));
      message.success("智能体已更新");
    } catch (e: any) {
      message.error(e.message || "更新智能体失败");
      set({ loading: false });
    }
  },

  deleteAgent: async (id) => {
    try {
      await agentsApi.delete(id);
      set((s) => ({
        agents: s.agents.filter((a) => a.id !== id),
        selectedAgent: s.selectedAgent?.id === id ? null : s.selectedAgent,
      }));
      message.success("智能体已删除");
    } catch (e: any) {
      message.error(e.message || "删除智能体失败");
    }
  },

  runAgent: async (id, input) => {
    const res = await agentsApi.run(id, input);
    return res.result;
  },
}));
