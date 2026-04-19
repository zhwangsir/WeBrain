import { describe, expect, it } from "vitest";
import { isWineryClawManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects WineryClaw-managed device names", () => {
    expect(isWineryClawManagedMatrixDevice("WineryClaw Gateway")).toBe(true);
    expect(isWineryClawManagedMatrixDevice("WineryClaw Debug")).toBe(true);
    expect(isWineryClawManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isWineryClawManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale WineryClaw-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "WineryClaw Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "WineryClaw Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "WineryClaw Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary.currentDeviceId).toBe("du314Zpw3A");
    expect(summary.currentWineryClawDevices).toEqual([
      expect.objectContaining({ deviceId: "du314Zpw3A" }),
    ]);
    expect(summary.staleWineryClawDevices).toEqual([
      expect.objectContaining({ deviceId: "BritdXC6iL" }),
      expect.objectContaining({ deviceId: "G6NJU9cTgs" }),
    ]);
  });
});
