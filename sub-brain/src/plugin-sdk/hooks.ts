/**
 * Plugin SDK — Lifecycle Hooks
 * Plugin lifecycle hooks: pre/post tool call, pre/post llm call
 */

export type HookType =
  | "pre_tool_call"
  | "post_tool_call"
  | "pre_llm_call"
  | "post_llm_call"
  | "on_session_start"
  | "on_session_end"
  | "on_startup"
  | "on_shutdown";

export interface ToolCallContext {
  tool: string;
  params: Record<string, unknown>;
  agentId?: string;
  sessionId?: string;
  userId?: string;
}

export interface LLMCallContext {
  messages: Array<Record<string, unknown>>;
  model?: string;
  temperature?: number;
  agentId?: string;
  sessionId?: string;
}

export interface HookResult {
  allowed: boolean;
  modified?: Record<string, unknown>;
  error?: string;
  reason?: string;
}

export type PreToolCallHook = (ctx: ToolCallContext) => Promise<HookResult>;
export type PostToolCallHook = (ctx: ToolCallContext, result: unknown) => Promise<HookResult>;
export type PreLLMCallHook = (ctx: LLMCallContext) => Promise<HookResult>;
export type PostLLMCallHook = (ctx: LLMCallContext, response: unknown) => Promise<HookResult>;
export type SessionHook = (sessionId: string, meta?: Record<string, unknown>) => Promise<void>;

export interface PluginHooks {
  pre_tool_call?: PreToolCallHook[];
  post_tool_call?: PostToolCallHook[];
  pre_llm_call?: PreLLMCallHook[];
  post_llm_call?: PostLLMCallHook[];
  on_session_start?: SessionHook[];
  on_session_end?: SessionHook[];
  on_startup?: Array<() => Promise<void>>;
  on_shutdown?: Array<() => Promise<void>>;
}

export class HookRegistry {
  private hooks: PluginHooks = {
    pre_tool_call: [],
    post_tool_call: [],
    pre_llm_call: [],
    post_llm_call: [],
    on_session_start: [],
    on_session_end: [],
    on_startup: [],
    on_shutdown: [],
  };

  register(type: HookType, handler: any): void {
    const arr = this.hooks[type] as any[];
    if (arr) arr.push(handler);
  }

  async runPreToolCall(ctx: ToolCallContext): Promise<HookResult> {
    for (const hook of this.hooks.pre_tool_call || []) {
      const result = await hook(ctx);
      if (!result.allowed) return result;
      if (result.modified) ctx.params = { ...ctx.params, ...result.modified };
    }
    return { allowed: true };
  }

  async runPostToolCall(ctx: ToolCallContext, result: unknown): Promise<unknown> {
    for (const hook of this.hooks.post_tool_call || []) {
      await hook(ctx, result);
    }
    return result;
  }

  async runPreLLMCall(ctx: LLMCallContext): Promise<HookResult> {
    for (const hook of this.hooks.pre_llm_call || []) {
      const result = await hook(ctx);
      if (!result.allowed) return result;
      if (result.modified) {
        const mod = result.modified as any;
        if (mod.messages) ctx.messages = mod.messages;
        if (mod.temperature !== undefined) ctx.temperature = mod.temperature;
      }
    }
    return { allowed: true };
  }

  async runPostLLMCall(ctx: LLMCallContext, response: unknown): Promise<unknown> {
    for (const hook of this.hooks.post_llm_call || []) {
      await hook(ctx, response);
    }
    return response;
  }

  async runSessionStart(sessionId: string, meta?: Record<string, unknown>): Promise<void> {
    for (const hook of this.hooks.on_session_start || []) {
      await hook(sessionId, meta);
    }
  }

  async runSessionEnd(sessionId: string, meta?: Record<string, unknown>): Promise<void> {
    for (const hook of this.hooks.on_session_end || []) {
      await hook(sessionId, meta);
    }
  }

  async runStartup(): Promise<void> {
    for (const hook of this.hooks.on_startup || []) {
      await hook();
    }
  }

  async runShutdown(): Promise<void> {
    for (const hook of this.hooks.on_shutdown || []) {
      await hook();
    }
  }
}

export const hookRegistry = new HookRegistry();
