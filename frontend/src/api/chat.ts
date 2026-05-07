import { api } from "./client";
import type { ChatMessage, ToolCall } from "./types";

export const chatApi = {
  send: (text: string, sessionId: string, agentId: string, toolsEnabled = true) =>
    api.post<{ reply: string; toolCalls?: ToolCall[] }>("/brain/chat", {
      message: text,
      session_id: sessionId,
      agent_id: agentId,
      tools_enabled: toolsEnabled,
    }),
  stream: (text: string, sessionId: string, agentId: string, toolsEnabled = true, signal?: AbortSignal) =>
    api.stream("/brain/chat/stream", { message: text, session_id: sessionId, agent_id: agentId, tools_enabled: toolsEnabled }, signal),
  getHistory: (sessionId: string) =>
    api.get<{ messages: ChatMessage[] }>(`/brain/chat/history?session_id=${sessionId}`).then((r) => r.messages || []),
  getSessions: () =>
    api
      .get<{ sessions: { id: string; title: string; updatedAt: string }[] }>("/brain/chat/sessions")
      .then((r) => r.sessions || []),
  deleteSession: (sessionId: string) => api.delete(`/brain/chat/sessions/${sessionId}`),
};
