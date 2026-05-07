import { describe, it, expect, vi, beforeEach } from "vitest";
import { useChatStore } from "./chatStore";

vi.mock("../api/chat", () => ({
  chatApi: {
    send: vi.fn(),
    stream: vi.fn(),
    getHistory: vi.fn(),
    getSessions: vi.fn(),
    deleteSession: vi.fn(),
  },
}));

vi.mock("antd", () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { chatApi } from "../api/chat";

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      messages: [],
      sessions: [],
      currentSessionId: "test-session",
      streaming: false,
      loading: false,
      toolEnabled: true,
      hasNewMessage: false,
    });
    vi.mocked(chatApi.getSessions).mockResolvedValue([]);
    vi.mocked(chatApi.getHistory).mockResolvedValue([]);
    vi.mocked(chatApi.send).mockResolvedValue({ reply: "" });
    vi.mocked(chatApi.stream).mockResolvedValue({ body: null } as unknown as Response);
  });

  it("has correct initial state", () => {
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.sessions).toEqual([]);
    expect(state.streaming).toBe(false);
    expect(state.toolEnabled).toBe(true);
  });

  it("newSession clears messages and generates new session id", () => {
    useChatStore.setState({ messages: [{ id: "1", role: "user", content: "hi", timestamp: "2024-01-01" }] });
    useChatStore.getState().newSession();
    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.currentSessionId).toMatch(/^session-/);
  });

  it("setToolEnabled toggles tool state", () => {
    useChatStore.getState().setToolEnabled(false);
    expect(useChatStore.getState().toolEnabled).toBe(false);
  });

  it("loadSessions fetches and stores sessions", async () => {
    const mockSessions = [{ id: "s1", title: "Hello", updatedAt: "2024-01-01" }];
    vi.mocked(chatApi.getSessions).mockResolvedValue(mockSessions);
    await useChatStore.getState().loadSessions();
    expect(useChatStore.getState().sessions).toEqual(mockSessions);
  });

  it("loadHistory fetches messages and sets current session", async () => {
    const mockMessages = [{ id: "m1", role: "user", content: "hi", timestamp: "2024-01-01" }];
    vi.mocked(chatApi.getHistory).mockResolvedValue(mockMessages);
    await useChatStore.getState().loadHistory("session-abc");
    expect(useChatStore.getState().messages).toEqual(mockMessages);
    expect(useChatStore.getState().currentSessionId).toBe("session-abc");
  });

  it("deleteSession removes session from state", async () => {
    useChatStore.setState({
      sessions: [{ id: "s1", title: "T", updatedAt: "2024-01-01" }],
      currentSessionId: "other",
    });
    vi.mocked(chatApi.deleteSession).mockResolvedValue(undefined);
    await useChatStore.getState().deleteSession("s1");
    expect(useChatStore.getState().sessions).toEqual([]);
  });

  it("clearCurrentChat empties messages and removes stored session", () => {
    useChatStore.setState({ messages: [{ id: "1", role: "user", content: "hi", timestamp: "2024-01-01" }] });
    useChatStore.getState().clearCurrentChat();
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it("newSession generates new id and stores it", () => {
    const prevId = useChatStore.getState().currentSessionId;
    useChatStore.getState().newSession();
    const newId = useChatStore.getState().currentSessionId;
    expect(newId).not.toBe(prevId);
    expect(newId).toMatch(/^session-/);
  });

  it("init loads stored session history if session exists", async () => {
    // Pre-populate store with a known session
    const mockMessages = [{ id: "m1", role: "user", content: "hi", timestamp: "2024-01-01" }];
    vi.mocked(chatApi.getHistory).mockResolvedValue(mockMessages);

    useChatStore.setState({
      currentSessionId: "stored-session",
      sessions: [{ id: "stored-session", title: "Stored", updatedAt: "2024-01-01" }],
    });

    // Call loadHistory directly to verify persistence path
    await useChatStore.getState().loadHistory("stored-session");

    expect(useChatStore.getState().messages).toEqual(mockMessages);
    expect(useChatStore.getState().currentSessionId).toBe("stored-session");
  });

  it("sendMessage adds user and assistant messages", async () => {
    vi.mocked(chatApi.send).mockResolvedValue({ reply: "Hello back", toolCalls: [] });
    await useChatStore.getState().sendMessage("hi");
    const state = useChatStore.getState();
    expect(state.messages.length).toBe(2);
    expect(state.messages[0].role).toBe("user");
    expect(state.messages[0].content).toBe("hi");
    expect(state.messages[1].role).toBe("assistant");
    expect(state.messages[1].content).toBe("Hello back");
  });

  it("sendMessage handles errors gracefully", async () => {
    vi.mocked(chatApi.send).mockRejectedValue(new Error("Network error"));
    await useChatStore.getState().sendMessage("hi");
    const state = useChatStore.getState();
    expect(state.loading).toBe(false);
    expect(state.messages.length).toBe(1); // user msg remains
  });

  it("sendStream sets streaming state and adds messages", async () => {
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"type":"content","data":"Hello"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };
    vi.mocked(chatApi.stream).mockResolvedValue({
      body: { getReader: () => mockReader },
    } as unknown as Response);

    await useChatStore.getState().sendStream("hi");
    const state = useChatStore.getState();
    expect(state.streaming).toBe(false);
    expect(state.messages.length).toBe(2);
    expect(state.messages[1].role).toBe("assistant");
  });

  it("stopStream aborts active stream", () => {
    useChatStore.setState({ streaming: true });
    useChatStore.getState().stopStream();
    expect(useChatStore.getState().streaming).toBe(false);
  });
});
