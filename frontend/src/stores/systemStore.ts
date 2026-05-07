import { create } from "zustand";
import { systemApi } from "../api/system";
import { configApi } from "../api/config";
import type { SystemHealth, Notification } from "../api/types";

interface SystemState {
  health: SystemHealth | null;
  modelHealth: Record<string, any> | null;
  loading: boolean;
  notifications: Notification[];
  sidebarCollapsed: boolean;
  theme: "light" | "dark";

  fetchHealth: () => Promise<void>;
  fetchModelHealth: () => Promise<void>;
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  toggleSidebar: () => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;
}

function getStoredTheme(): "light" | "dark" {
  const stored = localStorage.getItem("webrain-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export const useSystemStore = create<SystemState>((set) => ({
  health: null,
  modelHealth: null,
  loading: false,
  notifications: [],
  sidebarCollapsed: false,
  theme: getStoredTheme(),

  fetchHealth: async () => {
    try {
      const [hb, mb] = await Promise.all([
        systemApi.health().catch(() => null),
        systemApi.subBrainHealth().catch(() => null),
      ]);
      set({ health: hb, modelHealth: mb as any });
    } catch {
      /* health check failed silently */
    }
  },

  fetchModelHealth: async () => {
    try {
      const h = await configApi.health();
      set({ modelHealth: h as any });
    } catch {
      /* health check failed silently */
    }
  },

  addNotification: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  clearNotifications: () => set({ notifications: [] }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setTheme: (t) => {
    localStorage.setItem("webrain-theme", t);
    set({ theme: t });
  },

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      localStorage.setItem("webrain-theme", next);
      return { theme: next };
    }),
}));
