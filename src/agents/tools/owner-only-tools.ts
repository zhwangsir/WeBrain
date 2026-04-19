export const WINERYCLAW_OWNER_ONLY_CORE_TOOL_NAMES = ["cron", "gateway", "nodes"] as const;

const WINERYCLAW_OWNER_ONLY_CORE_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  WINERYCLAW_OWNER_ONLY_CORE_TOOL_NAMES,
);

export function isWineryClawOwnerOnlyCoreToolName(toolName: string): boolean {
  return WINERYCLAW_OWNER_ONLY_CORE_TOOL_NAME_SET.has(toolName);
}
