import { describe, expect, it } from "vitest";
import {
  ensureWineryClawExecMarkerOnProcess,
  markWineryClawExecEnv,
  WINERYCLAW_CLI_ENV_VALUE,
  WINERYCLAW_CLI_ENV_VAR,
} from "./openclaw-exec-env.js";

describe("markWineryClawExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", WINERYCLAW_CLI: "0" };
    const marked = markWineryClawExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      WINERYCLAW_CLI: WINERYCLAW_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.WINERYCLAW_CLI).toBe("0");
  });
});

describe("ensureWineryClawExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [WINERYCLAW_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureWineryClawExecMarkerOnProcess(env)).toBe(env);
    expect(env[WINERYCLAW_CLI_ENV_VAR]).toBe(WINERYCLAW_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[WINERYCLAW_CLI_ENV_VAR];
    delete process.env[WINERYCLAW_CLI_ENV_VAR];

    try {
      expect(ensureWineryClawExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[WINERYCLAW_CLI_ENV_VAR]).toBe(WINERYCLAW_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[WINERYCLAW_CLI_ENV_VAR];
      } else {
        process.env[WINERYCLAW_CLI_ENV_VAR] = previous;
      }
    }
  });
});
