import { create } from "zustand";
import { message } from "antd";
import { chatApi } from "../api/chat";
import type { ChatMessage } from "../api/types";

interface ChatState {
  messages: ChatMessage[];
  sessions: { id: string; title: string; updatedAt: string }[];
  currentSessionId: string;
  streaming: boolean;
  loading: boolean;
  toolEnabled: boolean;
  hasNewMessage: boolean; // for scroll indicator

  setMessages: (msgs: ChatMessage[]) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (updater: (msg: ChatMessage) => ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  setToolEnabled: (v: boolean) => void;
  setHasNewMessage: (v: boolean) => void;
  sendMessage: (text: string) => Promise<void>;
  sendStream: (text: string) => Promise<void>;
  stopStream: () => void;
  loadHistory: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  newSession: () => void;
  deleteSession: (sessionId: string) => Promise<void>;
  clearCurrentChat: () => void;
  init: () => Promise<void>;
}

let streamAbortController: AbortController | null = null;

function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem("webrain-chat-session-id");
  } catch {
    return null;
  }
}

function setStoredSessionId(id: string | null) {
  try {
    if (id) localStorage.setItem("webrain-chat-session-id", id);
    else localStorage.removeItem("webrain-chat-session-id");
  } catch {
    /* ignore */
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  sessions: [],
  currentSessionId: getStoredSessionId() || `session-${Date.now()}`,
  streaming: false,
  loading: false,
  toolEnabled: true,
  hasNewMessage: false,

  setMessages: (msgs) => set({ messages: msgs }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastMessage: (updater) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0) msgs[msgs.length - 1] = updater(msgs[msgs.length - 1]);
      return { messages: msgs };
    }),
  setStreaming: (v) => set({ streaming: v }),
  setToolEnabled: (v) => set({ toolEnabled: v }),
  setHasNewMessage: (v) => set({ hasNewMessage: v }),

  sendMessage: async (text) => {
    const { currentSessionId, toolEnabled } = get();
    set({ loading: true });
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));
    try {
      const res = await chatApi.send(text, currentSessionId, toolEnabled);
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        toolCalls: res.toolCalls,
        timestamp: new Date().toISOString(),
      };
      set((s) => ({ messages: [...s.messages, assistantMsg], loading: false }));
    } catch (e: any) {
      message.error(e.message || "发送消息失败");
      set({ loading: false });
    }
  },

  sendStream: async (text) => {
    const { currentSessionId, toolEnabled } = get();
    set({ streaming: true, hasNewMessage: false });

    // Cancel any previous stream
    if (streamAbortController) {
      streamAbortController.abort();
    }
    streamAbortController = new AbortController();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg] }));

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, assistantMsg] }));

    try {
      const response = await chatApi.stream(text, currentSessionId, toolEnabled, streamAbortController.signal);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const chunk = JSON.parse(data);
            if (chunk.type === "content") {
              set((s) => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: last.content + chunk.data };
                }
                return { messages: msgs };
              });
            }
          } catch {
            /* ignore invalid SSE chunk */
          }
        }
      }
      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        msgs[msgs.length - 1] = { ...last, isStreaming: false };
        return { messages: msgs, streaming: false };
      });
      get().loadSessions();
    } catch (e: any) {
      if (e.name === "AbortError" || e.message?.includes("aborted")) {
        // User cancelled — keep partial content, mark as done
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last.role === "assistant") {
            msgs[msgs.length - 1] = { ...last, isStreaming: false };
          }
          return { messages: msgs, streaming: false };
        });
      } else {
        message.error(e.message || "流式响应失败");
        set((s) => ({
          messages: s.messages.filter((m) => !(m.role === "assistant" && m.content === "" && m.isStreaming)),
          streaming: false,
        }));
      }
    } finally {
      streamAbortController = null;
    }
  },

  stopStream: () => {
    if (streamAbortController) {
      streamAbortController.abort();
      streamAbortController = null;
    }
    set({ streaming: false });
  },

  loadHistory: async (sessionId) => {
    try {
      const msgs = await chatApi.getHistory(sessionId);
      setStoredSessionId(sessionId);
      set({ messages: Array.isArray(msgs) ? msgs : [], currentSessionId: sessionId });
    } catch (e: any) {
      message.error(e.message || "加载历史失败");
    }
  },

  loadSessions: async () => {
    try {
      const sessions = await chatApi.getSessions();
      set({ sessions: Array.isArray(sessions) ? sessions : [] });
    } catch (e: any) {
      message.error(e.message || "加载会话失败");
    }
  },

  newSession: () => {
    const id = `session-${Date.now()}`;
    setStoredSessionId(id);
    set({
      messages: [],
      currentSessionId: id,
    });
  },

  deleteSession: async (sessionId) => {
    try {
      await chatApi.deleteSession(sessionId);
      set((s) => {
        const sessions = s.sessions.filter((ss) => ss.id !== sessionId);
        const nextState: Partial<ChatState> = { sessions };
        if (s.currentSessionId === sessionId) {
          nextState.messages = [];
          nextState.currentSessionId = `session-${Date.now()}`;
        }
        return nextState;
      });
    } catch (e: any) {
      message.error(e.message || "删除会话失败");
    }
  },

  clearCurrentChat: () => {
    set({ messages: [] });
    setStoredSessionId(null);
  },

  init: async () => {
    const { loadHistory, loadSessions } = get();
    await loadSessions();
    const storedId = getStoredSessionId();
    if (storedId) {
      const sessionExists = get().sessions.some((s) => s.id === storedId);
      if (sessionExists) {
        await loadHistory(storedId);
      } else {
        // Session may have messages but not in sessions list yet (new session)
        // Try loading history anyway — backend will return messages if any
        try {
          const msgs = await chatApi.getHistory(storedId);
          if (msgs.length > 0) {
            set({ messages: msgs, currentSessionId: storedId });
          } else {
            setStoredSessionId(null);
            set({ currentSessionId: `session-${Date.now()}` });
          }
        } catch {
          setStoredSessionId(null);
          set({ currentSessionId: `session-${Date.now()}` });
        }
      }
    }
  },
}));
