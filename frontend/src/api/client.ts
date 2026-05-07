/**
 * WeBrain API Client — Centralized HTTP layer
 * Features: interceptors, error handling, request deduplication, retry
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";

const BASE_URL = "";

class ApiClient {
  private instance: AxiosInstance;
  private pendingRequests = new Map<string, AbortController>();

  constructor() {
    this.instance = axios.create({
      baseURL: BASE_URL,
      timeout: 60000,
      headers: { "Content-Type": "application/json" },
    });

    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("webrain-api-key");
        if (token) config.headers.Authorization = `Bearer ${token}`;
        const key = `${config.method}_${config.url}_${JSON.stringify(config.params)}`;
        if (this.pendingRequests.has(key)) {
          this.pendingRequests.get(key)!.abort();
        }
        const controller = new AbortController();
        config.signal = controller.signal;
        this.pendingRequests.set(key, controller);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.instance.interceptors.response.use(
      (response) => {
        const config = response.config;
        const key = `${config.method}_${config.url}_${JSON.stringify(config.params)}`;
        this.pendingRequests.delete(key);
        return response;
      },
      (error: AxiosError) => {
        const cfg = error.config;
        if (cfg) {
          const key = `${cfg.method}_${cfg.url}_${JSON.stringify(cfg.params)}`;
          this.pendingRequests.delete(key);
        }
        if (axios.isCancel(error)) {
          return Promise.reject(new Error("Request cancelled"));
        }
        const status = error.response?.status;
        const message = (error.response?.data as any)?.message || error.message;
        if (status === 401) {
          console.error("[API] Unauthorized — check API key");
        } else if (status === 429) {
          console.error("[API] Rate limited — please slow down");
        }
        return Promise.reject(new ApiError(status || 0, message));
      }
    );
  }

  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.get<T>(url, config).then((r) => r.data);
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.post<T>(url, data, config).then((r) => r.data);
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.instance.put<T>(url, data, config).then((r) => r.data);
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.instance.delete<T>(url, config).then((r) => r.data);
  }

  stream(url: string, data?: Record<string, unknown>, signal?: AbortSignal) {
    const qs = data ? "?" + new URLSearchParams(data as Record<string, string>).toString() : "";
    return fetch(url + qs, { method: "GET", signal });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = new ApiClient();
