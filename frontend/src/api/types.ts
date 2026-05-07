/**
 * WeBrain API Shared Types
 */

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SystemHealth {
  status: "ok" | "degraded" | "down";
  component: string;
  modules: Record<string, boolean>;
}

export interface ModelEndpoint {
  name: string;
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  priority: number;
  timeout: number;
  healthy?: boolean;
}

export interface ModelConfig {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  endpoints: ModelEndpoint[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  timestamp: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolResult {
  toolCallId: string;
  output: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  role: string;
  model: string;
  systemPrompt: string;
  tools: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

export interface Memory {
  id: string;
  level: "L1" | "L2" | "L3" | "L4";
  content: string;
  source: string;
  sessionId?: string;
  createdAt: string;
  vectorScore?: number;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  config: Record<string, unknown>;
  messageCount: number;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  icon?: string;
}

export interface WikiNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  links: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KgEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  mentionCount: number;
}

export interface KgRelation {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
}

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
