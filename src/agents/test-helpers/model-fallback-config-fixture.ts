import type { WineryClawConfig } from "../../config/types.openclaw.js";

export function makeModelFallbackCfg(overrides: Partial<WineryClawConfig> = {}): WineryClawConfig {
  return {
    agents: {
      defaults: {
        model: {
          primary: "openai/gpt-4.1-mini",
          fallbacks: ["anthropic/claude-haiku-3-5"],
        },
      },
    },
    ...overrides,
  } as WineryClawConfig;
}
