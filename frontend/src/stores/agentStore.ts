import { create } from "zustand";
import { message } from "antd";
import { agentsApi } from "../api/agents";
import type { Agent, AgentToolConfig } from "../api/types";

const CURRENT_AGENT_KEY = "webrain-current-agent-id";

function getStoredAgentId(): string | null {
  try { return localStorage.getItem(CURRENT_AGENT_KEY); } catch { return null; }
}
function setStoredAgentId(id: string | null) {
  try { if (id) localStorage.setItem(CURRENT_AGENT_KEY, id); else localStorage.removeItem(CURRENT_AGENT_KEY); } catch { /* ignore */ }
}

interface AgentState {
  agents: Agent[];
  selectedAgent: Agent | null;
  currentAgentId: string;
  loading: boolean;

  fetchAgents: () => Promise<void>;
  selectAgent: (id: string) => void;
  createAgent: (data: Partial<Agent>) => Promise<Agent | undefined>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  runAgent: (id: string, input: string) => Promise<string>;
  getSystemPrompt: (id: string) => Promise<string>;
  updateSystemPrompt: (id: string, content: string) => Promise<void>;
  getTools: (id: string) => Promise<AgentToolConfig[]>;
  updateTools: (id: string, tools: AgentToolConfig[]) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  currentAgentId: getStoredAgentId() || "agent-default",
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await agentsApi.list();
      const list = Array.isArray(agents) ? agents : [];
      set({ agents: list, loading: false });
      // Ensure currentAgentId is valid
      const { currentAgentId } = get();
      if (!list.find((a) => a.id === currentAgentId) && list.length > 0) {
        const defaultAgent = list.find((a) => a.isDefault) || list[0];
        set({ currentAgentId: defaultAgent.id });
        setStoredAgentId(defaultAgent.id);
      }
    } catch (e: any) {
      message.error(e.message || "获取智能体失败");
      set({ loading: false });
    }
  },

  selectAgent: (id) => {
    const agent = get().agents.find((a) => a.id === id) || null;
    set({ selectedAgent: agent, currentAgentId: id });
    setStoredAgentId(id);
  },

  createAgent: async (data) => {
    set({ loading: true });
    try {
      const agent = await agentsApi.create(data);
      set((s) => ({ agents: [...s.agents, agent], loading: false }));
      message.success("智能体已创建");
      return agent;
    } catch (e: any) {
      message.error(e.message || "创建智能体失败");
      set({ loading: false });
      return undefined;
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
      set((s) => {
        const remaining = s.agents.filter((a) => a.id !== id);
        let currentId = s.currentAgentId;
        if (currentId === id && remaining.length > 0) {
          currentId = remaining[0].id;
          setStoredAgentId(currentId);
        }
        return {
          agents: remaining,
          selectedAgent: s.selectedAgent?.id === id ? null : s.selectedAgent,
          currentAgentId: currentId,
        };
      });
      message.success("智能体已删除");
    } catch (e: any) {
      message.error(e.message || "删除智能体失败");
    }
  },

  runAgent: async (id, input) => {
    const res = await agentsApi.run(id, input);
    return res.result;
  },

  getSystemPrompt: async (id) => {
    try {
      return await agentsApi.getSystemPrompt(id);
    } catch (e: any) {
      message.error(e.message || "获取系统提示词失败");
      return "";
    }
  },

  updateSystemPrompt: async (id, content) => {
    try {
      await agentsApi.updateSystemPrompt(id, content);
      message.success("系统提示词已更新");
    } catch (e: any) {
      message.error(e.message || "更新系统提示词失败");
    }
  },

  getTools: async (id) => {
    try {
      return await agentsApi.getTools(id);
    } catch (e: any) {
      message.error(e.message || "获取工具配置失败");
      return [];
    }
  },

  updateTools: async (id, tools) => {
    try {
      await agentsApi.updateTools(id, tools);
      message.success("工具配置已更新");
    } catch (e: any) {
      message.error(e.message || "更新工具配置失败");
    }
  },
}));
