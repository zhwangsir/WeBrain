import { api } from "./client";
import type { CronJob, CronJobData } from "./types";

export const cronApi = {
  list: () => api.get<{ jobs: CronJob[] }>("/brain/cron/jobs").then((r) => r.jobs),
  create: (data: CronJobData) => api.post<{ ok: boolean; job: CronJob }>("/brain/cron/jobs", data).then((r) => r.job),
  get: (id: string) => api.get<{ job: CronJob }>(`/brain/cron/jobs/${id}`).then((r) => r.job),
  enable: (id: string) => api.post(`/brain/cron/jobs/${id}/enable`),
  disable: (id: string) => api.post(`/brain/cron/jobs/${id}/disable`),
  delete: (id: string) => api.delete(`/brain/cron/jobs/${id}`),
  runs: (jobId?: string, limit = 50) =>
    api.get<{ runs: any[] }>("/brain/cron/runs", { params: { job_id: jobId, limit } }).then((r) => r.runs),
  stats: () => api.get<any>("/brain/cron/stats"),
};
