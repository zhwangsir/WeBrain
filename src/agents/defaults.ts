// Defaults for agent metadata when upstream does not supply them.
// WineryClaw: Default to local LM Studio models instead of cloud providers.
export const DEFAULT_PROVIDER = "lmstudio";
export const DEFAULT_MODEL = "glm-5.1";
// Conservative fallback used when model metadata is unavailable.
export const DEFAULT_CONTEXT_TOKENS = 200_000;
