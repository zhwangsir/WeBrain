import { describe, expect, it } from "vitest";
import {
  isWineryClawOwnerOnlyCoreToolName,
  WINERYCLAW_OWNER_ONLY_CORE_TOOL_NAMES,
} from "./tools/owner-only-tools.js";

describe("createWineryClawTools owner authorization", () => {
  it("marks owner-only core tool names", () => {
    expect(WINERYCLAW_OWNER_ONLY_CORE_TOOL_NAMES).toEqual(["cron", "gateway", "nodes"]);
    expect(isWineryClawOwnerOnlyCoreToolName("cron")).toBe(true);
    expect(isWineryClawOwnerOnlyCoreToolName("gateway")).toBe(true);
    expect(isWineryClawOwnerOnlyCoreToolName("nodes")).toBe(true);
  });

  it("keeps canvas non-owner-only", () => {
    expect(isWineryClawOwnerOnlyCoreToolName("canvas")).toBe(false);
  });
});
