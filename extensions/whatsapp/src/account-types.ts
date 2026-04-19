import type { WineryClawConfig } from "openclaw/plugin-sdk/config-runtime";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<WineryClawConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
