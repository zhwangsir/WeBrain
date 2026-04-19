import { createConfigIO, getRuntimeConfigSnapshot, type WineryClawConfig } from "../config/config.js";

export function loadBrowserConfigForRuntimeRefresh(): WineryClawConfig {
  return getRuntimeConfigSnapshot() ?? createConfigIO().loadConfig();
}
