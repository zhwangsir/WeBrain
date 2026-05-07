import { create } from "zustand";
import { message } from "antd";
import { channelsApi } from "../api/channels";
import type { ChannelInfo } from "../api/channels";

interface ChannelState {
  channels: ChannelInfo[];
  selectedChannel: ChannelInfo | null;
  messages: any[];
  loading: boolean;
  fetchChannels: () => Promise<void>;
  selectChannel: (id: string) => void;
  connectChannel: (channel: string, config: unknown) => Promise<void>;
  disconnectChannel: (id: string) => Promise<void>;
  toggleChannel: (id: string) => Promise<void>;
  fetchMessages: (id: string) => Promise<void>;
  fetchHealth: (id: string) => Promise<boolean>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  selectedChannel: null,
  messages: [],
  loading: false,

  fetchChannels: async () => {
    set({ loading: true });
    try {
      const channels = await channelsApi.list();
      set({ channels: Array.isArray(channels) ? channels : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取通道列表失败");
      set({ loading: false });
    }
  },

  selectChannel: (id) => {
    const ch = get().channels.find((c) => c.id === id) || null;
    set({ selectedChannel: ch });
  },

  connectChannel: async (channel, config) => {
    try {
      await channelsApi.connect(channel, config);
      await get().fetchChannels();
      message.success("通道已连接");
    } catch (e: any) {
      message.error(e.message || "连接通道失败");
    }
  },

  disconnectChannel: async (id) => {
    try {
      await channelsApi.disconnect(id);
      set((s) => ({
        channels: s.channels.map((c) => (c.id === id ? { ...c, connected: false } : c)),
      }));
      message.success("通道已断开");
    } catch (e: any) {
      message.error(e.message || "断开通道失败");
    }
  },

  toggleChannel: async (id) => {
    try {
      await channelsApi.toggle(id);
      set((s) => ({
        channels: s.channels.map((c) => (c.id === id ? { ...c, connected: !c.connected } : c)),
      }));
    } catch (e: any) {
      message.error(e.message || "切换通道状态失败");
    }
  },

  fetchMessages: async (id) => {
    try {
      const res = await channelsApi.messages(id);
      set({ messages: Array.isArray(res.messages) ? res.messages : [] });
    } catch (e: any) {
      message.error(e.message || "获取消息失败");
    }
  },

  fetchHealth: async (id) => {
    try {
      const res = await channelsApi.health(id);
      return res.healthy;
    } catch {
      return false;
    }
  },
}));
