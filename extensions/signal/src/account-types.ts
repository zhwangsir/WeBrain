import type { WineryClawConfig } from "openclaw/plugin-sdk/config-runtime";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<WineryClawConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
