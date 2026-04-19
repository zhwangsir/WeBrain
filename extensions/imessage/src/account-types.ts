import type { WineryClawConfig } from "openclaw/plugin-sdk/config-runtime";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<WineryClawConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
