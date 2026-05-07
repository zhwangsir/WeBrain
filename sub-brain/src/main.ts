/**
 * WeBrain Sub Brain — 无安全限制版
 * 工具自注册 + Plugin SDK Hooks + Playwright + Docker Sandbox + Skills + MCP + CLI
 * Streaming + Multi-model + Heartbeat
 */

import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import { spawn, ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join, resolve as pathResolve } from "path";
import { existsSync } from "fs";
import { ToolExecutor } from "./tools/tool-executor.js";
import { ChannelManager } from "./channels/channel-manager.js";
import { PluginLoader } from "./plugins/plugin-loader.js";
import { EcosystemHub } from "./ecosystem/ecosystem-hub.js";
import { DokobotClient } from "./dokobot/dokobot-client.js";
import { ModelConfigManager } from "./config/model-config.js";
import { LayeredConfigManager } from "./config/layered-config.js";
import { IdentityManager } from "./identity/identity-manager.js";
import { AgentManager } from "./agent/agent-manager.js";
import { hookRegistry } from "./plugin-sdk/hooks.js";
import { PlaywrightBrowser } from "./browser/playwright-browser.js";
import { DockerSandbox } from "./sandbox/docker-sandbox.js";
import { SkillManager } from "./skills/skill-manager.js";
import { MCPClient } from "./mcp/mcp-client.js";
import { WeBrainCLI } from "./cli/webrain-cli.js";

const PORT = parseInt(process.env.WEBRAIN_SUB_BRAIN_PORT || "3000", 10);
const MAIN_BRAIN_PORT = parseInt(process.env.WEBRAIN_MAIN_BRAIN_PORT || "18790", 10);
const MAIN_BRAIN_UDS = process.env.WEBRAIN_MAIN_BRAIN_UDS || "/tmp/webrain-main.sock";
const USE_UDS = !process.env.WEBRAIN_MAIN_BRAIN_UDS && !process.env.WEBRAIN_MAIN_BRAIN_PORT;
const MAIN_BRAIN_URL = USE_UDS ? "http://localhost" : `http://127.0.0.1:${MAIN_BRAIN_PORT}`;
const EMBEDDED = process.env.WEBRAIN_EMBEDDED === "1";
const __dirname = dirname(fileURLToPath(import.meta.url));

function mainBrainAxiosConfig(): any {
  return USE_UDS ? { socketPath: MAIN_BRAIN_UDS } : {};
}

const LOG_LEVEL = (process.env.LOG_LEVEL || "info").toLowerCase() as "fatal" | "error" | "warn" | "info" | "debug" | "trace";
const app = Fastify({ logger: { level: LOG_LEVEL } });
await app.register(cors, { origin: true, credentials: true });
await app.register(websocket);

import { registerAuth } from "./server/auth.js";
import { registerStatic } from "./server/static.js";
import { registerMetrics } from "./server/metrics.js";
registerAuth(app);
const frontendDist = registerStatic(app, __dirname);
registerMetrics(app);

// ===== Trace ID =====
app.addHook("onRequest", async (request, reply) => {
  const traceId = request.headers["x-trace-id"] as string || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  (request as any).traceId = traceId;
  reply.header("x-trace-id", traceId);
});

app.addHook("onResponse", async (request, reply) => {
  const traceId = (request as any).traceId || "-";
  app.log.info({ traceId, method: request.method, url: request.url, statusCode: reply.statusCode, responseTime: reply.elapsedTime }, "request completed");
});

const wsConnections = new Set<any>();

const browser = new PlaywrightBrowser();

const state = {
  toolExecutor: new ToolExecutor(),
  channelManager: new ChannelManager(),
  pluginLoader: new PluginLoader(),
  ecosystemHub: new EcosystemHub(),
  dokobot: new DokobotClient(browser),
  modelConfig: new ModelConfigManager(),
  layeredConfig: new LayeredConfigManager(),
  identityManager: new IdentityManager(),
  agentManager: new AgentManager({
    mainBrainUrl: MAIN_BRAIN_URL,
    subBrainUrl: `http://127.0.0.1:${PORT}`,
  }),
  browser,
  dockerSandbox: new DockerSandbox(),
  skillManager: new SkillManager(),
  mcpClient: new MCPClient(),
  cli: new WeBrainCLI({ subBrainUrl: `http://127.0.0.1:${PORT}`, mainBrainUrl: MAIN_BRAIN_URL }),
};

await state.toolExecutor.initialize();
await state.channelManager.initialize();
state.channelManager.setBroadcastHandler((msg: any) => {
  const payload = JSON.stringify(msg);
  for (const socket of wsConnections) {
    if (socket.readyState === 1) {
      socket.send(payload);
    }
  }
});
await Promise.all([
  state.pluginLoader.initialize(),
  state.ecosystemHub.initialize(),
  hookRegistry.runStartup(),
]);

const dockerAvailable = state.dockerSandbox.isAvailable();

// ===== Start Main Brain (Python) as child process =====
let mainBrainProc: ChildProcess | null = null;

function startMainBrain(): Promise<void> {
  return new Promise((resolve, reject) => {
    const mainBrainPaths = [
      pathResolve(__dirname, "./main-brain/main_brain.py"),
      pathResolve(__dirname, "../main-brain/main_brain.py"),
    ];
    const mainBrainScript = mainBrainPaths.find((p) => existsSync(p));
    if (!mainBrainScript) {
      app.log.warn("[main-brain] main_brain.py not found. Main brain will not be started.");
      resolve();
      return;
    }

    const pythonCmd = process.env.WEBRAIN_PYTHON || "python3";
    // Clean up stale UDS socket
    try { if (USE_UDS) require("fs").unlinkSync(MAIN_BRAIN_UDS); } catch {}
    const args = USE_UDS
      ? [mainBrainScript, "--uds", MAIN_BRAIN_UDS]
      : [mainBrainScript, "--host", "127.0.0.1", "--port", String(MAIN_BRAIN_PORT)];
    mainBrainProc = spawn(pythonCmd, args, {
      stdio: "inherit",
      env: { ...process.env, WEBRAIN_EMBEDDED: "1", WEBRAIN_SUB_BRAIN_URL: "http://127.0.0.1:3000" },
    });

    mainBrainProc.on("error", (err) => {
      app.log.error(`[main-brain] Failed to start: ${err.message}`);
      reject(err);
    });

    // Wait a moment for main brain to start
    setTimeout(() => {
      app.log.info("[main-brain] Spawned as child process");
      resolve();
    }, 3000);
  });
}

function stopMainBrain(): void {
  if (mainBrainProc && !mainBrainProc.killed) {
    mainBrainProc.kill("SIGTERM");
    setTimeout(() => {
      if (mainBrainProc && !mainBrainProc.killed) {
        mainBrainProc.kill("SIGKILL");
      }
    }, 5000);
  }
}

process.on("SIGINT", () => {
  app.log.info("[shutdown] SIGINT received, stopping services...");
  stopMainBrain();
  app.close().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  app.log.info("[shutdown] SIGTERM received, stopping services...");
  stopMainBrain();
  app.close().then(() => process.exit(0));
});

app.log.info("[sub-brain] Running without security restrictions.");

// ========== Health ==========
app.get("/health", async () => ({
  status: "ok",
  component: "sub-brain",
  modules: {
    tools: true,
    channels: true,
    plugins: true,
    ecosystem: true,
    dokobot: true,
    modelConfig: true,
    layeredConfig: true,
    identity: true,
    agents: true,
    browser: true,
    sandbox: dockerAvailable,
    skills: true,
    mcp: true,
    cli: true,
    hooks: true,
  },
}));

// ========== Model Config (Multi-endpoint support) ==========
app.get("/config/model", async () => state.modelConfig.get());

app.post("/config/model", async (request) => {
  const body = request.body as any;

  // Support both single-endpoint and multi-endpoint configs
  let saved: any;
  if (body.endpoints && Array.isArray(body.endpoints)) {
    // Multi-endpoint config
    saved = state.modelConfig.save({
      endpoints: body.endpoints.map((ep: any) => ({
        name: ep.name || "unnamed",
        baseUrl: ep.baseUrl || ep.base_url,
        modelId: ep.modelId || ep.model_id || "default",
        apiKey: ep.apiKey || ep.api_key,
        priority: ep.priority ?? 0,
        timeout: ep.timeout ?? 120,
      })),
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });
  } else {
    // Single endpoint fallback
    saved = state.modelConfig.save({
      baseUrl: body.baseUrl,
      modelId: body.modelId || body.model,
      apiKey: body.apiKey,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
    });
  }

  // Notify main-brain to reload config
  try {
    const axios = (await import("axios")).default;
    await axios.post(`${MAIN_BRAIN_URL}/config/reload`, {}, { timeout: 5000, ...mainBrainAxiosConfig() });
  } catch {
    // Main brain may not be available
  }
  return { ok: true, config: saved };
});

app.post("/config/model/detect", async () => state.modelConfig.detect());
app.post("/config/model/reset", async () => ({ ok: true, config: state.modelConfig.reset() }));

// ========== Layered Config ==========
app.get("/config/global", async () => state.layeredConfig.getGlobal());
app.post("/config/global", async (request) => {
  const body = request.body as any;
  return { ok: true, config: state.layeredConfig.updateGlobal(body) };
});
app.get("/config/workspaces", async () => ({ ok: true, workspaces: state.layeredConfig.listWorkspaces() }));
app.get("/config/workspace/:id", async (request) => {
  const { id } = request.params as any;
  return { ok: true, workspace: state.layeredConfig.getWorkspace(id) };
});
app.post("/config/workspace", async (request) => {
  const body = request.body as any;
  return { ok: true, workspace: state.layeredConfig.addWorkspace(body) };
});
app.get("/config/workspace/:id/agents", async (request) => {
  const { id } = request.params as any;
  return { ok: true, agents: state.layeredConfig.listAgents(id) };
});
app.get("/config/agent/:wid/:aid", async (request) => {
  const { wid, aid } = request.params as any;
  return { ok: true, agent: state.layeredConfig.getAgent(aid, wid) };
});
app.post("/config/agent", async (request) => {
  const { agent, workspaceId } = request.body as any;
  return { ok: true, agent: state.layeredConfig.addAgent(agent, workspaceId) };
});

// ========== Tools ==========
app.post("/tools/execute", async (request) => {
  const { tool, params } = request.body as any;
  const result = await state.toolExecutor.execute(tool, params || {});
  return result;
});

app.get("/tools/list", async () => ({ tools: state.toolExecutor.listTools() }));
app.post("/tools/enable", async (request) => {
  const { tool } = request.body as any;
  state.toolExecutor.enableTool(tool);
  return { ok: true };
});
app.post("/tools/disable", async (request) => {
  const { tool } = request.body as any;
  state.toolExecutor.disableTool(tool);
  return { ok: true };
});
app.post("/tools/global-toggle", async (request) => {
  const { enabled } = request.body as any;
  state.toolExecutor.setGlobalEnabled(enabled);
  return { ok: true, globalEnabled: enabled };
});

// ========== Channels ==========
app.post("/channels/connect", async (request) => {
  const { channel, config } = request.body as any;
  return state.channelManager.connect(channel, config);
});
app.post("/channels/send", async (request) => {
  const { channel, recipient, content } = request.body as any;
  return state.channelManager.send(channel, recipient, content);
});
app.post("/channels/disconnect", async (request) => {
  const { channel_id } = request.body as any;
  return state.channelManager.disconnect(channel_id);
});
app.get("/channels/list", async () => ({ channels: state.channelManager.listChannels() }));
app.get("/channels/:id/health", async (request) => {
  const { id } = request.params as any;
  return { ok: true, healthy: await state.channelManager.healthCheck(id) };
});
app.get("/channels/:id/messages", async (request) => {
  const { id } = request.params as any;
  return { messages: state.channelManager.getMessages(id) };
});
app.post("/channels/:id/receive/start", async (request) => {
  const { id } = request.params as any;
  return state.channelManager.startReceiving(id);
});
app.post("/channels/:id/receive/stop", async (request) => {
  const { id } = request.params as any;
  return state.channelManager.stopReceiving(id);
});
app.post("/channels/:id/toggle", async (request) => {
  const { id } = request.params as any;
  return state.channelManager.toggle(id);
});

// ========== Plugins ==========
app.post("/plugins/load", async (request) => {
  const { plugin_id, config } = request.body as any;
  return state.pluginLoader.load(plugin_id, config);
});
app.post("/plugins/unload", async (request) => {
  const { plugin_id } = request.body as any;
  return state.pluginLoader.unload(plugin_id);
});
app.post("/plugins/enable", async (request) => {
  const { plugin_id } = request.body as any;
  await state.pluginLoader.enable(plugin_id);
  return { ok: true };
});
app.post("/plugins/disable", async (request) => {
  const { plugin_id } = request.body as any;
  await state.pluginLoader.disable(plugin_id);
  return { ok: true };
});
app.get("/plugins/list", async () => ({ plugins: state.pluginLoader.listPlugins() }));
app.get("/plugins/:id/manifest", async (request) => {
  const { id } = request.params as any;
  return { ok: true, manifest: state.pluginLoader.getPluginManifest(id) };
});
app.post("/plugins/load-from-disk", async (request) => {
  const { path, plugin_id } = request.body as any;
  return state.pluginLoader.loadFromDisk(path, plugin_id);
});

// ========== Ecosystem ==========
app.post("/ecosystem/register", async (request) => {
  const { name, type, data, owner } = request.body as any;
  return state.ecosystemHub.register(name, type, data, owner);
});
app.post("/ecosystem/share", async (request) => {
  const { resource_id, target } = request.body as any;
  return state.ecosystemHub.share(resource_id, target);
});
app.post("/ecosystem/revoke", async (request) => {
  const { resource_id, target } = request.body as any;
  return state.ecosystemHub.revoke(resource_id, target);
});
app.post("/ecosystem/delete", async (request) => {
  const { resource_id } = request.body as any;
  return state.ecosystemHub.deleteResource(resource_id);
});
app.get("/ecosystem/resources", async () => ({ resources: state.ecosystemHub.listResources() }));

// ========== Dokobot ==========
app.post("/dokobot/browse", async (request) => {
  const { url, action } = request.body as any;
  return state.dokobot.browse(url, action);
});
app.post("/dokobot/search", async (request) => {
  const { query } = request.body as any;
  return state.dokobot.search(query);
});
app.post("/dokobot/screenshot", async (request) => {
  const { url } = request.body as any;
  return state.dokobot.screenshot(url);
});
app.get("/dokobot/status", async () => ({
  available: state.dokobot.isAvailable(),
}));

// ========== Browser ==========
app.post("/browser/launch", async (request) => {
  const { headless } = request.body as any;
  try { await state.browser.launch(headless !== false); return { ok: true }; }
  catch (err: any) { return { ok: false, error: err.message }; }
});
app.post("/browser/page", async (request) => {
  const { url } = request.body as any;
  try { const s = await state.browser.newPage(url); return { ok: true, session: s }; }
  catch (err: any) { return { ok: false, error: err.message }; }
});
app.post("/browser/:id/navigate", async (request) => {
  const { id } = request.params as any;
  const { url } = request.body as any;
  try { const s = await state.browser.navigate(id, url); return { ok: true, session: s }; }
  catch (err: any) { return { ok: false, error: err.message }; }
});
app.post("/browser/:id/click", async (request) => {
  const { id } = request.params as any;
  const { selector } = request.body as any;
  try { const s = await state.browser.click(id, selector); return { ok: true, session: s }; }
  catch (err: any) { return { ok: false, error: err.message }; }
});
app.post("/browser/:id/type", async (request) => {
  const { id } = request.params as any;
  const { selector, text } = request.body as any;
  try { const s = await state.browser.type(id, selector, text); return { ok: true, session: s }; }
  catch (err: any) { return { ok: false, error: err.message }; }
});
app.post("/browser/:id/screenshot", async (request) => {
  const { id } = request.params as any;
  const { fullPage } = request.body as any;
  try { const s = await state.browser.screenshot(id, fullPage); return { ok: true, screenshot: s }; }
  catch (err: any) { return { ok: false, error: err.message }; }
});
app.get("/browser/sessions", async () => ({ sessions: await state.browser.listSessions() }));

// ========== Sandbox ==========
app.post("/sandbox/execute", async (request) => {
  const { command, inputFiles } = request.body as any;
  return state.dockerSandbox.execute(command, inputFiles);
});
app.post("/sandbox/python", async (request) => {
  const { code } = request.body as any;
  return state.dockerSandbox.executePython(code);
});
app.get("/sandbox/status", async () => ({
  available: state.dockerSandbox.isAvailable(),
}));

// ========== Skills ==========
app.get("/skills", async () => ({ skills: state.skillManager.listSkills() }));
app.post("/skills", async (request) => {
  const { name, description, code, language, triggerPatterns, tags } = request.body as any;
  const skill = state.skillManager.createSkill(name, description, code, language, triggerPatterns, undefined, tags);
  return { ok: true, skill };
});
app.get("/skills/:id", async (request) => {
  const { id } = request.params as any;
  const skill = state.skillManager.getSkill(id);
  return { ok: !!skill, skill };
});
app.post("/skills/:id/invoke", async (request) => {
  const { id } = request.params as any;
  const { params, session_id } = request.body as any;
  try {
    const result = await state.skillManager.invokeSkill(id, params || {}, session_id || "default");
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});
app.get("/skills/stats", async () => state.skillManager.getStats());

// ========== MCP ==========
app.post("/mcp/connect", async (request) => {
  const result = await state.mcpClient.connectServer(request.body as any);
  return result;
});
app.get("/mcp/servers", async () => ({ servers: state.mcpClient.listServers() }));
app.get("/mcp/tools", async () => ({ tools: state.mcpClient.listTools() }));
app.post("/mcp/:server/tool", async (request) => {
  const { server } = request.params as any;
  const { tool, params } = request.body as any;
  try {
    const result = await state.mcpClient.callTool(server, tool, params || {});
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// ========== CLI ==========
app.get("/cli/status", async () => {
  const text = await state.cli.status();
  return { text };
});
app.post("/cli/chat", async (request) => {
  const { message, session_id } = request.body as any;
  const reply = await state.cli.chat(message, session_id);
  return { reply };
});
app.post("/cli/exec", async (request) => {
  const { tool, params } = request.body as any;
  const result = await state.cli.exec(tool, params || {});
  return { result };
});

// ========== Hooks ==========
app.get("/hooks/registry", async () => ({
  hooks: ["pre_tool_call", "post_tool_call", "pre_llm_call", "post_llm_call", "on_session_start", "on_session_end", "on_startup", "on_shutdown"],
}));

// ========== Identity ==========
app.get("/identity/users", async () => ({ users: state.identityManager.listUsers() }));
app.get("/identity/user/:id", async (request) => {
  const { id } = request.params as any;
  const user = state.identityManager.getUser(id);
  return { ok: !!user, user };
});
app.post("/identity/user", async (request) => {
  const { name, role, workspaces } = request.body as any;
  const user = state.identityManager.createUser(name, role, workspaces);
  return { ok: true, user };
});
app.get("/identity/user/:id/workspaces/:ws", async (request) => {
  const { id, ws } = request.params as any;
  return { ok: true, access: state.identityManager.hasWorkspaceAccess(id, ws) };
});

// ========== Agents ==========
app.get("/agents", async (request, reply) => {
  if (request.headers.accept?.includes("text/html")) {
    await reply.sendFile("index.html");
    return;
  }
  return { agents: state.agentManager.listAgents() };
});
app.post("/agents", async (request) => {
  const card = request.body as any;
  const agent = state.agentManager.createAgent(card);
  return { ok: true, agent };
});
app.get("/agents/:id", async (request) => {
  const { id } = request.params as any;
  const agent = state.agentManager.getAgent(id);
  return { ok: !!agent, agent };
});
app.get("/agents/:id/tasks", async (request) => {
  const { id } = request.params as any;
  return { tasks: state.agentManager.listTasks(id) };
});
app.post("/agents/:id/tasks", async (request) => {
  const { id } = request.params as any;
  const { type, payload, contextId } = request.body as any;
  const task = state.agentManager.createTask(id, type, payload || {}, contextId || `ctx-${id}`);
  return { ok: true, task };
});
app.post("/agents/tasks/:taskId/start", async (request) => {
  const { taskId } = request.params as any;
  state.agentManager.startTask(taskId);
  return { ok: true };
});
app.post("/agents/tasks/:taskId/complete", async (request) => {
  const { taskId } = request.params as any;
  const { result } = request.body as any;
  state.agentManager.completeTask(taskId, result);
  return { ok: true };
});
app.post("/agents/tasks/:taskId/fail", async (request) => {
  const { taskId } = request.params as any;
  const { error } = request.body as any;
  state.agentManager.failTask(taskId, error);
  return { ok: true };
});
app.post("/agents/:from/delegate/:to", async (request) => {
  const { from, to } = request.params as any;
  const { type, payload } = request.body as any;
  const task = await state.agentManager.delegateTask(from, to, type, payload || {});
  return { ok: true, task };
});
app.get("/agents/:id/card", async (request) => {
  const { id } = request.params as any;
  const agent = state.agentManager.getAgent(id);
  return { ok: !!agent, card: agent };
});
app.post("/agents/:id/status", async (request) => {
  const { id } = request.params as any;
  const { status } = request.body as any;
  state.agentManager.updateAgentStatus(id, status);
  return { ok: true };
});
app.put("/agents/:id", async (request) => {
  const { id } = request.params as any;
  const updates = request.body as any;
  const agent = state.agentManager.updateAgent(id, updates);
  return { ok: !!agent, agent };
});
app.delete("/agents/:id", async (request) => {
  const { id } = request.params as any;
  const ok = state.agentManager.deleteAgent(id);
  return { ok };
});

// ========== Agent File System (system.md, tools.yaml) ==========
app.get("/agents/:id/system-prompt", async (request) => {
  const { id } = request.params as any;
  const files = state.agentManager.getAgentFiles(id);
  if (!files) return { ok: false, error: "Agent not found" };
  return { ok: true, content: files.systemPrompt };
});
app.put("/agents/:id/system-prompt", async (request) => {
  const { id } = request.params as any;
  const { content } = request.body as any;
  const ok = state.agentManager.updateAgentSystemPrompt(id, content);
  return { ok };
});
app.get("/agents/:id/tools", async (request) => {
  const { id } = request.params as any;
  const files = state.agentManager.getAgentFiles(id);
  if (!files) return { ok: false, error: "Agent not found" };
  return { ok: true, tools: files.tools };
});
app.put("/agents/:id/tools", async (request) => {
  const { id } = request.params as any;
  const { tools } = request.body as any;
  const ok = state.agentManager.updateAgentTools(id, tools);
  return { ok };
});

app.post("/agents/tasks/:taskId/cancel", async (request) => {
  const { taskId } = request.params as any;
  const ok = state.agentManager.cancelTask(taskId);
  return { ok };
});

// ========== Agent Harness ==========
app.get("/agents/:id/harness/state", async (request) => {
  const { id } = request.params as any;
  return state.agentManager.getHarnessState(id);
});
app.post("/agents/:id/harness/run/:taskId", async (request) => {
  const { id, taskId } = request.params as any;
  return state.agentManager.runTaskWithHarness(taskId);
});
app.post("/agents/:id/harness/pause", async (request) => {
  const { id } = request.params as any;
  return state.agentManager.pauseHarness(id);
});
app.post("/agents/:id/harness/bind", async (request) => {
  const { id } = request.params as any;
  const { subagentId, role, capabilities } = request.body as any;
  return state.agentManager.bindSubagent(id, subagentId, role, capabilities || []);
});

// ========== Agent Collaboration (A2A) ==========
app.post("/agents/:id/broadcast", async (request) => {
  const { id } = request.params as any;
  const { topic, payload } = request.body as any;
  const msg = await state.agentManager.broadcast(id, topic || "general", payload || {});
  return { ok: true, message: msg };
});
app.post("/agents/:id/message", async (request) => {
  const { id } = request.params as any;
  const { to, topic, payload } = request.body as any;
  const msg = await state.agentManager.sendMessage(id, to, topic || "general", payload || {});
  return { ok: true, message: msg };
});
app.post("/agents/:id/request", async (request) => {
  const { id } = request.params as any;
  const { to, action, params, timeoutMs } = request.body as any;
  const resp = await state.agentManager.request(id, to, action, params || {}, timeoutMs || 30000);
  return { ok: true, response: resp };
});
app.get("/agents/:id/conversations", async (request) => {
  const { id } = request.params as any;
  return { conversations: state.agentManager.listConversations(id) };
});
app.get("/agents/conversations/:convId", async (request) => {
  const { convId } = request.params as any;
  return { conversation: state.agentManager.getConversation(convId) };
});
app.get("/agents/messages", async (request) => {
  const { from, to, type, topic, limit } = request.query as any;
  return { messages: state.agentManager.getMessages({ from, to, type, topic, limit: limit ? parseInt(limit) : undefined }) };
});
app.get("/agents/collaboration/stats", async () => state.agentManager.getCollaborationStats());

// ========== Consensus / Voting ==========
app.post("/proposals", async (request) => {
  const { proposerId, topic, description, quorum, timeoutSec } = request.body as any;
  const proposal = state.agentManager.createProposal(proposerId, topic, description, quorum || 1, timeoutSec || 300);
  return { ok: true, proposal };
});
app.post("/proposals/:id/vote", async (request) => {
  const { id } = request.params as any;
  const { agentId, vote, reason } = request.body as any;
  return state.agentManager.vote(agentId, id, vote, reason);
});
app.get("/proposals", async (request) => {
  const { status } = request.query as any;
  return { proposals: state.agentManager.listProposals(status as any) };
});
app.get("/proposals/:id", async (request) => {
  const { id } = request.params as any;
  return { proposal: state.agentManager.getProposal(id) };
});
app.post("/proposals/:id/close", async (request) => {
  const { id } = request.params as any;
  return state.agentManager.closeProposal(id);
});

// ========== Agent Templates ==========
app.get("/templates", async (request) => {
  const { category, tag } = request.query as any;
  return { templates: state.agentManager.listTemplates(category, tag) };
});
app.get("/templates/categories", async () => ({ categories: state.agentManager.getTemplateCategories() }));
app.get("/templates/tags", async () => ({ tags: state.agentManager.getTemplateTags() }));
app.get("/templates/:id", async (request) => {
  const { id } = request.params as any;
  return { template: state.agentManager.getTemplate(id) };
});
app.post("/templates", async (request) => {
  const tpl = request.body as any;
  const created = state.agentManager.createTemplate(tpl);
  return { ok: true, template: created };
});
app.delete("/templates/:id", async (request) => {
  const { id } = request.params as any;
  return { ok: state.agentManager.deleteTemplate(id) };
});
app.post("/templates/:id/instantiate", async (request) => {
  const { id } = request.params as any;
  const { name, workspaceId, owner, variables } = request.body as any;
  const result = state.agentManager.instantiateTemplate(id, { name, workspaceId, owner, variables });
  if (result.ok && result.card) {
    const agent = state.agentManager.createAgent(result.card as any);
    return { ok: true, agent, fromTemplate: id };
  }
  return { ok: false, error: result.error };
});

// ========== Workflows ==========
app.get("/workflows", async (request) => {
  const { workspaceId } = request.query as any;
  return { workflows: state.agentManager.listWorkflows(workspaceId) };
});
app.get("/workflows/:id", async (request) => {
  const { id } = request.params as any;
  return { workflow: state.agentManager.getWorkflow(id) };
});
app.post("/workflows", async (request) => {
  const def = request.body as any;
  return state.agentManager.createWorkflow(def);
});
app.put("/workflows/:id", async (request) => {
  const { id } = request.params as any;
  const updates = request.body as any;
  return state.agentManager.updateWorkflow(id, updates);
});
app.delete("/workflows/:id", async (request) => {
  const { id } = request.params as any;
  return { ok: state.agentManager.deleteWorkflow(id) };
});
app.get("/workflows/:id/validate", async (request) => {
  const { id } = request.params as any;
  return state.agentManager.validateWorkflow(id);
});
app.post("/workflows/:id/run", async (request) => {
  const { id } = request.params as any;
  const { inputs } = request.body as any;
  const run = await state.agentManager.runWorkflow(id, inputs || {});
  return { ok: true, run };
});
app.get("/workflows/:id/runs", async (request) => {
  const { id } = request.params as any;
  const { status } = request.query as any;
  return { runs: state.agentManager.listWorkflowRuns(id, status as any) };
});
app.get("/workflow-runs/:runId", async (request) => {
  const { runId } = request.params as any;
  return { run: state.agentManager.getWorkflowRun(runId) };
});
app.post("/workflow-runs/:runId/cancel", async (request) => {
  const { runId } = request.params as any;
  return { ok: state.agentManager.cancelWorkflowRun(runId) };
});

// ========== Sandbox ==========
app.get("/sandbox/policies", async () => ({
  policies: [],
}));
app.get("/sandbox/stats", async () => state.agentManager.getSandboxStats());
app.get("/sandbox/audit", async (request) => {
  const { agentId, limit } = request.query as any;
  return { logs: state.agentManager.getSandboxAuditLogs(agentId, limit ? parseInt(limit) : 100) };
});
app.post("/sandbox/:agentId/policy", async (request) => {
  const { agentId } = request.params as any;
  const policy = state.agentManager.createSandboxPolicy(agentId, request.body as any);
  return { ok: true, policy };
});
app.get("/sandbox/:agentId/policy", async (request) => {
  const { agentId } = request.params as any;
  return { policy: state.agentManager.getSandboxPolicy(agentId) };
});
app.put("/sandbox/:agentId/policy", async (request) => {
  const { agentId } = request.params as any;
  const policy = state.agentManager.updateSandboxPolicy(agentId, request.body as any);
  return { ok: !!policy, policy };
});
app.post("/sandbox/:agentId/session", async (request) => {
  const { agentId } = request.params as any;
  const session = state.agentManager.createSandboxSession(agentId);
  return { ok: true, session };
});

// ========== Agent Stats ==========
app.get("/agents/stats", async () => state.agentManager.getStats());

// ========== Chat Streaming (Proxy to main brain) ==========
app.get("/chat/stream", async (request, reply) => {
  const { message, sessionId, toolsEnabled } = request.query as any;
  if (!message) {
    reply.code(400);
    return { error: "message is required" };
  }

  // Proxy SSE stream from main brain to client
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    const axios = (await import("axios")).default;
    const response = await axios.get(
      `${MAIN_BRAIN_URL}/chat/stream`,
      {
        params: {
          message,
          session_id: sessionId || "default",
          tools_enabled: toolsEnabled !== "false",
        },
        responseType: "stream",
        timeout: 300000, // 5 min
        ...mainBrainAxiosConfig(),
      }
    );

    response.data.on("data", (chunk: Buffer) => {
      reply.raw.write(chunk);
    });

    await new Promise<void>((resolve, reject) => {
      response.data.on("end", resolve);
      response.data.on("error", reject);
    });

    reply.raw.end();
  } catch (err: any) {
    reply.raw.write(`data: ${JSON.stringify({ type: "error", data: err.message })}\n\n`);
    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
  }
});

// ========== Model Health (Proxy to main brain) ==========
app.get("/health/models", async () => {
  try {
    const axios = (await import("axios")).default;
    const resp = await axios.get(`${MAIN_BRAIN_URL}/health/models`, { timeout: 10000, ...mainBrainAxiosConfig() });
    return resp.data;
  } catch (err: any) {
    return { status: "unknown", error: err.message, endpoints: [] };
  }
});

// ========== Metrics (Proxy to main brain) ==========
app.get("/metrics/query", async (request) => {
  try {
    const axios = (await import("axios")).default;
    const { name, start, end } = request.query as any;
    const resp = await axios.get(`${MAIN_BRAIN_URL}/metrics/query`, {
      params: { name, start, end },
      timeout: 10000,
      ...mainBrainAxiosConfig(),
    });
    return resp.data;
  } catch (err: any) {
    return { status: "unknown", error: err.message };
  }
});

// ========== Skillhub ==========
app.get("/skillhub/search", async (request) => {
  const { q } = request.query as any;
  const { execSync } = await import("child_process");
  const skillhubPath = "/Users/wangzhenyu/Documents/Project/WeBrain/webrain-integration/skillhub/skills_store_cli.py";
  try {
    const output = execSync(`python3 "${skillhubPath}" search "${(q || "").replace(/"/g, "\\")}" 2>&1`, {
      encoding: "utf-8",
      timeout: 30000,
      env: {
        ...process.env,
        SKILLHUB_HOME: `${process.env.HOME}/.webrain/skillhub`,
        SKILLHUB_INSTALL_ROOT: `${process.env.HOME}/.webrain/skills`,
        WEBRAIN_CONFIG_PATH: `${process.env.HOME}/.webrain/webrain.json`,
        WEBRAIN_WORKSPACE_PATH: `${process.env.HOME}/.webrain/workspace`,
        WEBRAIN_PLUGIN_DIR: `${process.env.HOME}/.webrain/extensions/skillhub`,
      },
    });
    return { ok: true, results: output };
  } catch (err: any) {
    return { ok: false, error: err.stderr || err.message };
  }
});
app.post("/skillhub/install", async (request) => {
  const { slug } = request.body as any;
  const { execSync } = await import("child_process");
  const skillhubPath = "/Users/wangzhenyu/Documents/Project/WeBrain/webrain-integration/skillhub/skills_store_cli.py";
  try {
    const output = execSync(`python3 "${skillhubPath}" install "${(slug || "").replace(/"/g, "\\")}" 2>&1`, {
      encoding: "utf-8",
      timeout: 60000,
      env: {
        ...process.env,
        SKILLHUB_HOME: `${process.env.HOME}/.webrain/skillhub`,
        SKILLHUB_INSTALL_ROOT: `${process.env.HOME}/.webrain/skills`,
        WEBRAIN_CONFIG_PATH: `${process.env.HOME}/.webrain/webrain.json`,
        WEBRAIN_WORKSPACE_PATH: `${process.env.HOME}/.webrain/workspace`,
        WEBRAIN_PLUGIN_DIR: `${process.env.HOME}/.webrain/extensions/skillhub`,
      },
    });
    return { ok: true, output };
  } catch (err: any) {
    return { ok: false, error: err.stderr || err.message };
  }
});
app.get("/skillhub/list", async () => {
  const { execSync } = await import("child_process");
  const skillhubPath = "/Users/wangzhenyu/Documents/Project/WeBrain/webrain-integration/skillhub/skills_store_cli.py";
  try {
    const output = execSync(`python3 "${skillhubPath}" list 2>&1`, {
      encoding: "utf-8",
      timeout: 30000,
      env: {
        ...process.env,
        SKILLHUB_HOME: `${process.env.HOME}/.webrain/skillhub`,
        SKILLHUB_INSTALL_ROOT: `${process.env.HOME}/.webrain/skills`,
        WEBRAIN_CONFIG_PATH: `${process.env.HOME}/.webrain/webrain.json`,
        WEBRAIN_WORKSPACE_PATH: `${process.env.HOME}/.webrain/workspace`,
        WEBRAIN_PLUGIN_DIR: `${process.env.HOME}/.webrain/extensions/skillhub`,
      },
    });
    return { ok: true, skills: output };
  } catch (err: any) {
    return { ok: false, error: err.stderr || err.message };
  }
});

// ========== A2A ==========
app.get("/a2a/tasks", async () => ({ tasks: state.agentManager.listTasks() }));
app.post("/a2a/task/send", async (request) => {
  const { senderId, receiverId, type, payload } = request.body as any;
  const task = await state.agentManager.delegateTask(senderId, receiverId, type, payload || {});
  return { ok: true, taskId: task.taskId, status: task.status };
});
app.get("/a2a/task/:taskId", async (request) => {
  const { taskId } = request.params as any;
  const task = state.agentManager.getTask(taskId);
  return { ok: !!task, task };
});

// ========== WebSocket ==========
app.get("/ws", { websocket: true }, (connection) => {
  wsConnections.add(connection.socket);
  connection.socket.on("close", () => wsConnections.delete(connection.socket));
  connection.socket.on("message", async (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === "tool.execute") {
        const result = await state.toolExecutor.execute(data.tool, data.params || {});
        connection.socket.send(JSON.stringify({ action: "tool.result", data: result }));
      } else if (data.action === "ping") {
        connection.socket.send(JSON.stringify({ action: "pong" }));
      }
    } catch (err) {
      connection.socket.send(JSON.stringify({ error: String(err) }));
    }
  });
});

import { registerBrainProxy } from "./server/proxy.js";
registerBrainProxy(app, MAIN_BRAIN_URL, USE_UDS, MAIN_BRAIN_UDS);

// Start main brain before listening (if not explicitly disabled)
if (process.env.WEBRAIN_NO_MAIN_BRAIN !== "1") {
  try {
    await startMainBrain();
  } catch (err: any) {
    app.log.error(`[main-brain] Startup failed: ${err.message}`);
  }
}

await app.listen({ port: PORT, host: "0.0.0.0" });
app.log.info(`Sub Brain running on http://0.0.0.0:${PORT}`);
if (frontendDist) {
  app.log.info(`UI available at http://localhost:${PORT}`);
}
