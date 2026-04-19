import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GATEWAY_PORT,
  resolveConfigPathCandidate,
  resolveGatewayPort,
  resolveIsNixMode,
  resolveStateDir,
} from "./config.js";
import { withTempHome } from "./test-helpers.js";

vi.unmock("../version.js");

function envWith(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  // Hermetic env: don't inherit process.env because other tests may mutate it.
  return { ...overrides };
}

describe("Nix integration (U3, U5, U9)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("U3: isNixMode env var detection", () => {
    it("isNixMode is false when WINERYCLAW_NIX_MODE is not set", () => {
      expect(resolveIsNixMode(envWith({ WINERYCLAW_NIX_MODE: undefined }))).toBe(false);
    });

    it("isNixMode is false when WINERYCLAW_NIX_MODE is empty", () => {
      expect(resolveIsNixMode(envWith({ WINERYCLAW_NIX_MODE: "" }))).toBe(false);
    });

    it("isNixMode is false when WINERYCLAW_NIX_MODE is not '1'", () => {
      expect(resolveIsNixMode(envWith({ WINERYCLAW_NIX_MODE: "true" }))).toBe(false);
    });

    it("isNixMode is true when WINERYCLAW_NIX_MODE=1", () => {
      expect(resolveIsNixMode(envWith({ WINERYCLAW_NIX_MODE: "1" }))).toBe(true);
    });
  });

  describe("U5: CONFIG_PATH and STATE_DIR env var overrides", () => {
    it("STATE_DIR defaults to ~/.openclaw when env not set", () => {
      expect(resolveStateDir(envWith({ WINERYCLAW_STATE_DIR: undefined }))).toMatch(/\.openclaw$/);
    });

    it("STATE_DIR respects WINERYCLAW_STATE_DIR override", () => {
      expect(resolveStateDir(envWith({ WINERYCLAW_STATE_DIR: "/custom/state/dir" }))).toBe(
        path.resolve("/custom/state/dir"),
      );
    });

    it("STATE_DIR respects WINERYCLAW_HOME when state override is unset", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveStateDir(envWith({ WINERYCLAW_HOME: customHome, WINERYCLAW_STATE_DIR: undefined })),
      ).toBe(path.join(path.resolve(customHome), ".wineryclaw"));
    });

    it("CONFIG_PATH defaults to WINERYCLAW_HOME/.wineryclaw/openclaw.json", () => {
      const customHome = path.join(path.sep, "custom", "home");
      expect(
        resolveConfigPathCandidate(
          envWith({
            WINERYCLAW_HOME: customHome,
            WINERYCLAW_CONFIG_PATH: undefined,
            WINERYCLAW_STATE_DIR: undefined,
          }),
        ),
      ).toBe(path.join(path.resolve(customHome), ".wineryclaw", "wineryclaw.json"));
    });

    it("CONFIG_PATH defaults to ~/.wineryclaw/openclaw.json when env not set", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ WINERYCLAW_CONFIG_PATH: undefined, WINERYCLAW_STATE_DIR: undefined }),
        ),
      ).toMatch(/\.openclaw[\\/]openclaw\.json$/);
    });

    it("CONFIG_PATH respects WINERYCLAW_CONFIG_PATH override", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ WINERYCLAW_CONFIG_PATH: "/nix/store/abc/openclaw.json" }),
        ),
      ).toBe(path.resolve("/nix/store/abc/openclaw.json"));
    });

    it("CONFIG_PATH expands ~ in WINERYCLAW_CONFIG_PATH override", async () => {
      await withTempHome(async (home) => {
        expect(
          resolveConfigPathCandidate(
            envWith({ WINERYCLAW_HOME: home, WINERYCLAW_CONFIG_PATH: "~/.wineryclaw/custom.json" }),
            () => home,
          ),
        ).toBe(path.join(home, ".wineryclaw", "custom.json"));
      });
    });

    it("CONFIG_PATH uses STATE_DIR when only state dir is overridden", () => {
      expect(
        resolveConfigPathCandidate(
          envWith({ WINERYCLAW_STATE_DIR: "/custom/state", WINERYCLAW_TEST_FAST: "1" }),
          () => path.join(path.sep, "tmp", "openclaw-config-home"),
        ),
      ).toBe(path.join(path.resolve("/custom/state"), "wineryclaw.json"));
    });
  });

  describe("U6: gateway port resolution", () => {
    it("uses default when env and config are unset", () => {
      expect(resolveGatewayPort({}, envWith({ WINERYCLAW_GATEWAY_PORT: undefined }))).toBe(
        DEFAULT_GATEWAY_PORT,
      );
    });

    it("prefers WINERYCLAW_GATEWAY_PORT over config", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19002 } },
          envWith({ WINERYCLAW_GATEWAY_PORT: "19001" }),
        ),
      ).toBe(19001);
    });

    it("falls back to config when env is invalid", () => {
      expect(
        resolveGatewayPort(
          { gateway: { port: 19003 } },
          envWith({ WINERYCLAW_GATEWAY_PORT: "nope" }),
        ),
      ).toBe(19003);
    });
  });
});
