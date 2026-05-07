import { create } from "zustand";
import { message } from "antd";
import { cronApi } from "../api/cron";
import type { CronJob, CronJobData } from "../api/cron";

interface CronState {
  jobs: CronJob[];
  runs: any[];
  stats: any;
  loading: boolean;
  fetchJobs: () => Promise<void>;
  createJob: (data: CronJobData) => Promise<void>;
  enableJob: (id: string) => Promise<void>;
  disableJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  fetchRuns: (jobId?: string) => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useCronStore = create<CronState>((set) => ({
  jobs: [],
  runs: [],
  stats: null,
  loading: false,

  fetchJobs: async () => {
    set({ loading: true });
    try {
      const jobs = await cronApi.list();
      set({ jobs: Array.isArray(jobs) ? jobs : [], loading: false });
    } catch (e: any) {
      message.error(e.message || "获取任务列表失败");
      set({ loading: false });
    }
  },

  createJob: async (data) => {
    set({ loading: true });
    try {
      const job = await cronApi.create(data);
      set((s) => ({ jobs: [...s.jobs, job], loading: false }));
      message.success("任务已创建");
    } catch (e: any) {
      message.error(e.message || "创建任务失败");
      set({ loading: false });
    }
  },

  enableJob: async (id) => {
    try {
      await cronApi.enable(id);
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === id ? { ...j, enabled: true } : j)),
      }));
      message.success("任务已启用");
    } catch (e: any) {
      message.error(e.message || "启用任务失败");
    }
  },

  disableJob: async (id) => {
    try {
      await cronApi.disable(id);
      set((s) => ({
        jobs: s.jobs.map((j) => (j.id === id ? { ...j, enabled: false } : j)),
      }));
      message.success("任务已禁用");
    } catch (e: any) {
      message.error(e.message || "禁用任务失败");
    }
  },

  deleteJob: async (id) => {
    try {
      await cronApi.delete(id);
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) }));
      message.success("任务已删除");
    } catch (e: any) {
      message.error(e.message || "删除任务失败");
    }
  },

  fetchRuns: async (jobId) => {
    try {
      const runs = await cronApi.runs(jobId);
      set({ runs: Array.isArray(runs) ? runs : [] });
    } catch (e: any) {
      message.error(e.message || "获取运行历史失败");
    }
  },

  fetchStats: async () => {
    try {
      const stats = await cronApi.stats();
      set({ stats });
    } catch (e: any) {
      message.error(e.message || "获取统计失败");
    }
  },
}));
