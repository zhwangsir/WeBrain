import type { MarkdownTableMode } from "./types.base.js";
import type { WineryClawConfig } from "./types.openclaw.js";

export type ResolveMarkdownTableModeParams = {
  cfg?: Partial<WineryClawConfig>;
  channel?: string | null;
  accountId?: string | null;
};

export type ResolveMarkdownTableMode = (
  params: ResolveMarkdownTableModeParams,
) => MarkdownTableMode;
