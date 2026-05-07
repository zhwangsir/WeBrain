import { api } from "./client";

export interface CronJobData {
  id?: string;
  name: string;
  cron_expr: string;
  task_type: string;
  task_params?: Record<string, unknown>;
  enabled?: boolean;
  max_retries?: number;
  webhook_url?: string;
}

export interface CronJob {
  id: string;
  name: string;
  cron_expr: string;
  task_type: string;
  task_params: Record<string, unknown>;
  enabled: boolean;
  max_retries: number;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
  last_run?: string;
  next_run?: string;
  run_count: number;
}

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
