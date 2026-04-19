export { definePluginEntry } from "openclaw/plugin-sdk/core";
export type {
  AnyAgentTool,
  WineryClawPluginApi,
  WineryClawPluginToolContext,
  WineryClawPluginToolFactory,
} from "openclaw/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "openclaw/plugin-sdk/windows-spawn";
