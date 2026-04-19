export type { ChannelPlugin, WineryClawPluginApi, PluginRuntime } from "openclaw/plugin-sdk/core";
export type { WineryClawConfig } from "openclaw/plugin-sdk/config-runtime";
export type {
  WineryClawPluginService,
  WineryClawPluginServiceContext,
  PluginLogger,
} from "openclaw/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/runtime.js";
