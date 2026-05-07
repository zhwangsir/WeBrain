import { api } from "./client";

export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  config?: Record<string, unknown>;
}

export const channelsApi = {
  list: () => api.get<{ channels: ChannelInfo[] }>("/channels/list").then((r) => r.channels),
  connect: (channel: string, config: unknown) => api.post("/channels/connect", { channel, config }),
  disconnect: (channel_id: string) => api.post("/channels/disconnect", { channel_id }),
  toggle: (id: string) => api.post(`/channels/${id}/toggle`),
  health: (id: string) => api.get<{ ok: boolean; healthy: boolean }>(`/channels/${id}/health`),
  messages: (id: string) => api.get<{ messages: any[] }>(`/channels/${id}/messages`),
  startReceiving: (id: string) => api.post(`/channels/${id}/receive/start`),
  stopReceiving: (id: string) => api.post(`/channels/${id}/receive/stop`),
};
