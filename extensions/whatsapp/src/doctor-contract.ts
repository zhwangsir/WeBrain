import type { ChannelDoctorConfigMutation } from "openclaw/plugin-sdk/channel-contract";
import type { WineryClawConfig } from "openclaw/plugin-sdk/config-runtime";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: WineryClawConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
