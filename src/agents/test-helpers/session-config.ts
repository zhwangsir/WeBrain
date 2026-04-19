import type { WineryClawConfig } from "../../config/types.openclaw.js";

export function createPerSenderSessionConfig(
  overrides: Partial<NonNullable<WineryClawConfig["session"]>> = {},
): NonNullable<WineryClawConfig["session"]> {
  return {
    mainKey: "main",
    scope: "per-sender",
    ...overrides,
  };
}
