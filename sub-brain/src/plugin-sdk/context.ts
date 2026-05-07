/**
 * Plugin Context Factory — creates runtime context for plugins
 */

import type { PluginManifest, PluginContext, ConfigStore, PluginLogger, ToolRegistry, EventBus, BrainBridge, LLMClient, LocalResources } from "./types.js";
import { PluginRegistry } from "./registry.js";
import { EventEmitter } from "events";

export function createPluginContext(manifest: PluginManifest, registry: PluginRegistry): PluginContext {
  const configData: Record<string, any> = {};
  const bus = new EventEmitter();

  const config: ConfigStore = {
    get(key, defaultValue) {
      return configData[key] ?? defaultValue;
    },
    set(key, value) {
      configData[key] = value;
    },
    getAll() {
      return { ...configData };
    },
  };

  const logger: PluginLogger = {
    debug: (msg, ...args) => console.log(`[${manifest.id}] DEBUG:`, msg, ...args),
    info: (msg, ...args) => console.log(`[${manifest.id}] INFO:`, msg, ...args),
    warn: (msg, ...args) => console.warn(`[${manifest.id}] WARN:`, msg, ...args),
    error: (msg, ...args) => console.error(`[${manifest.id}] ERROR:`, msg, ...args),
  };

  const tools: ToolRegistry = {
    register(tool) {
      registry.registerTool(manifest.id, tool);
    },
    unregister(name) {
      // Handled by registry.unload
    },
    list() {
      return registry.listTools();
    },
    get(name) {
      return registry.getTool(name);
    },
  };

  const eventBus: EventBus = {
    emit(event, payload) {
      bus.emit(event, payload);
    },
    on(event, handler) {
      bus.on(event, handler);
      return () => bus.off(event, handler);
    },
    off(event, handler) {
      bus.off(event, handler);
    },
  };

  const MAIN_BRAIN_UDS = process.env.WEBRAIN_MAIN_BRAIN_UDS || "/tmp/webrain-main.sock";
  const USE_UDS = !process.env.WEBRAIN_MAIN_BRAIN_UDS && !process.env.WEBRAIN_MAIN_BRAIN_PORT;
  const MAIN_BRAIN_URL = USE_UDS ? "http://localhost" : `http://127.0.0.1:${process.env.WEBRAIN_MAIN_BRAIN_PORT || "18790"}`;
  const SUB_BRAIN_URL = `http://127.0.0.1:${process.env.WEBRAIN_SUB_BRAIN_PORT || "9797"}`;

  const bridge: BrainBridge = {
    async callMainBrain(method, params) {
      const axios = (await import("axios")).default;
      const config: any = { timeout: 30000 };
      if (USE_UDS) config.socketPath = MAIN_BRAIN_UDS;
      const resp = await axios.post(`${MAIN_BRAIN_URL}/${method}`, params, config);
      return resp.data;
    },
    async callSubBrain(method, params) {
      const axios = (await import("axios")).default;
      const resp = await axios.post(`${SUB_BRAIN_URL}/${method}`, params, { timeout: 30000 });
      return resp.data;
    },
  };

  const llm: LLMClient = {
    async chat(messages, options = {}) {
      const axios = (await import("axios")).default;
      const config: any = { timeout: 120000 };
      if (USE_UDS) config.socketPath = MAIN_BRAIN_UDS;
      const resp = await axios.post(
        `${MAIN_BRAIN_URL}/chat`,
        { message: messages[messages.length - 1]?.content || "", session_id: "plugin", context: {} },
        config
      );
      return resp.data.reply;
    },
    async embed(texts) {
      return texts.map(() => new Array(128).fill(0));
    },
  };

  const local: LocalResources = {
    fs: {
      async read(path, encoding = "utf-8") {
        const { readFile } = await import("fs/promises");
        return readFile(path, encoding as any) as unknown as Promise<string>;
      },
      async write(path, content) {
        const { writeFile } = await import("fs/promises");
        await writeFile(path, content, "utf-8");
      },
      async list(dir) {
        const { readdir } = await import("fs/promises");
        return readdir(dir);
      },
    },
    shell: {
      async exec(command, timeout = 30000) {
        const { exec } = await import("child_process");
        return new Promise((resolve, reject) => {
          const child = exec(command, { timeout }, (error, stdout, stderr) => {
            resolve({ stdout, stderr, code: error ? (error as any).code || 1 : 0 });
          });
        });
      },
    },
  };

  return {
    manifest,
    pluginId: manifest.id,
    config,
    logger,
    tools,
    bus: eventBus,
    bridge,
    llm,
    local,
  };
}
