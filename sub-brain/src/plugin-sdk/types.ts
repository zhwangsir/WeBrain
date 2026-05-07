/**
 * WeBrain Plugin SDK v1 — Core Types
 * Based on OpenClaw concepts, enhanced for dual-brain architecture
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Runtime location: "main-brain" | "sub-brain" | "both" */
  runtime: "main-brain" | "sub-brain" | "both";
  /** Resource requirements */
  resources?: {
    gpu?: boolean;
    memory?: string;
    disk?: string;
    network?: boolean;
  };
  /** Capabilities this plugin provides */
  capabilities: PluginCapability[];
  /** Entry point module path */
  entry: string;
  /** Config schema (Zod-like JSON Schema) */
  configSchema?: Record<string, any>;
  /** Plugin dependencies */
  depends?: string[];
  /** Skills provided by this plugin */
  skills?: string[];
}

export type PluginCapability = "tool" | "channel" | "skill" | "provider" | "memory" | "handler";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  /** Which brain executes this tool */
  runtime?: "main-brain" | "sub-brain";
  /** Permissions required */
  permissions?: string[];
  /** Timeout in ms */
  timeout?: number;
  /** Execution handler */
  handler: (args: Record<string, any>, ctx: PluginContext) => Promise<any>;
}

export interface PluginContext {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Plugin ID */
  pluginId: string;
  /** Config store */
  config: ConfigStore;
  /** Logger */
  logger: PluginLogger;
  /** Tool registry */
  tools: ToolRegistry;
  /** Event bus for cross-plugin communication */
  bus: EventBus;
  /** Bridge to main brain */
  bridge: BrainBridge;
  /** LLM client */
  llm: LLMClient;
  /** Local resource access */
  local: LocalResources;
}

export interface ConfigStore {
  get<T = any>(key: string, defaultValue?: T): T;
  set<T = any>(key: string, value: T): void;
  getAll(): Record<string, any>;
}

export interface PluginLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface ToolRegistry {
  register(tool: ToolDefinition): void;
  unregister(toolName: string): void;
  list(): ToolDefinition[];
  get(toolName: string): ToolDefinition | undefined;
}

export interface EventBus {
  emit(event: string, payload: any): void;
  on(event: string, handler: (payload: any) => void): () => void;
  off(event: string, handler: (payload: any) => void): void;
}

export interface BrainBridge {
  callMainBrain(method: string, params: any): Promise<any>;
  callSubBrain(method: string, params: any): Promise<any>;
}

export interface LLMClient {
  chat(messages: Array<{ role: string; content: string }>, options?: any): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
}

export interface LocalResources {
  fs: {
    read(path: string, encoding?: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    list(dir: string): Promise<string[]>;
  };
  shell: {
    exec(command: string, timeout?: number): Promise<{ stdout: string; stderr: string; code: number }>;
  };
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  context: PluginContext;
  module: any;
  enabled: boolean;
}
