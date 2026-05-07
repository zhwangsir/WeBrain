import { api } from "./client";
import type { WikiNote } from "./types";

export const wikiApi = {
  list: (tag?: string, limit = 100) =>
    api.get<{ ok: boolean; notes: WikiNote[] }>("/brain/wiki/notes", { params: { tag, limit } }).then((r) => r.notes),
  get: (id: string) => api.get<{ ok: boolean; note: WikiNote }>(`/brain/wiki/notes/${id}`).then((r) => r.note),
  create: (data: Partial<WikiNote>) =>
    api.post<{ ok: boolean; note: WikiNote }>("/brain/wiki/notes", data).then((r) => r.note),
  update: (id: string, data: Partial<WikiNote>) =>
    api.put<{ ok: boolean; note: WikiNote }>(`/brain/wiki/notes/${id}`, data).then((r) => r.note),
  delete: (id: string) => api.delete(`/brain/wiki/notes/${id}`),
  search: (q: string, limit = 20) =>
    api
      .get<{ ok: boolean; results: WikiNote[] }>("/brain/wiki/search", { params: { q, limit } })
      .then((r) => r.results),
  stats: () => api.get<{ ok: boolean; stats: Record<string, any> }>("/brain/wiki/stats").then((r) => r.stats),
};
