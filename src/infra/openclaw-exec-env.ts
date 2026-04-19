export const WINERYCLAW_CLI_ENV_VAR = "WINERYCLAW_CLI";
export const WINERYCLAW_CLI_ENV_VALUE = "1";

export function markWineryClawExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [WINERYCLAW_CLI_ENV_VAR]: WINERYCLAW_CLI_ENV_VALUE,
  };
}

export function ensureWineryClawExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[WINERYCLAW_CLI_ENV_VAR] = WINERYCLAW_CLI_ENV_VALUE;
  return env;
}
