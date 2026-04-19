import { describe, expect, it } from "vitest";
import type { WineryClawConfig } from "../config/config.js";
import { isDefaultBrowserPluginEnabled } from "../plugin-enabled.js";

describe("isDefaultBrowserPluginEnabled", () => {
  it("defaults to enabled", () => {
    expect(isDefaultBrowserPluginEnabled({} as WineryClawConfig)).toBe(true);
  });

  it("respects explicit plugin disablement", () => {
    expect(
      isDefaultBrowserPluginEnabled({
        plugins: {
          entries: {
            browser: {
              enabled: false,
            },
          },
        },
      } as WineryClawConfig),
    ).toBe(false);
  });
});
