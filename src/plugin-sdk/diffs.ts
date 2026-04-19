// Narrow plugin-sdk surface for the bundled diffs plugin.
// Keep this list additive and scoped to the bundled diffs surface.

export { definePluginEntry } from "./plugin-entry.js";
export type { WineryClawConfig } from "../config/config.js";
export { resolvePreferredWineryClawTmpDir } from "../infra/tmp-openclaw-dir.js";
export type {
  AnyAgentTool,
  WineryClawPluginApi,
  WineryClawPluginConfigSchema,
  WineryClawPluginToolContext,
  PluginLogger,
} from "../plugins/types.js";
