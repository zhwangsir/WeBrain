import type { WineryClawConfig } from "../../config/types.js";

export type DirectoryConfigParams = {
  cfg: WineryClawConfig;
  accountId?: string | null;
  query?: string | null;
  limit?: number | null;
};
