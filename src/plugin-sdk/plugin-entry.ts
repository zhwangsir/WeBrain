import type { WineryClawConfig } from "../config/types.openclaw.js";
import { emptyPluginConfigSchema } from "../plugins/config-schema.js";
import type { ProviderRuntimeModel } from "../plugins/provider-runtime-model.types.js";
import type {
  AnyAgentTool,
  AgentHarness,
  MediaUnderstandingProviderPlugin,
  WineryClawPluginApi,
  WineryClawPluginCommandDefinition,
  WineryClawPluginConfigSchema,
  WineryClawPluginDefinition,
  WineryClawPluginNodeHostCommand,
  WineryClawPluginReloadRegistration,
  WineryClawPluginSecurityAuditCollector,
  WineryClawPluginSecurityAuditContext,
  WineryClawPluginService,
  WineryClawPluginServiceContext,
  WineryClawPluginToolContext,
  WineryClawPluginToolFactory,
  PluginLogger,
  ProviderAugmentModelCatalogContext,
  ProviderAuthContext,
  ProviderAuthDoctorHintContext,
  ProviderAuthMethod,
  ProviderAuthMethodNonInteractiveContext,
  ProviderAuthResult,
  ProviderApplyConfigDefaultsContext,
  ProviderBuildMissingAuthMessageContext,
  ProviderBuildUnknownModelHintContext,
  ProviderBuiltInModelSuppressionContext,
  ProviderBuiltInModelSuppressionResult,
  ProviderCacheTtlEligibilityContext,
  ProviderCatalogContext,
  ProviderCatalogResult,
  ProviderDeferSyntheticProfileAuthContext,
  ProviderDefaultThinkingPolicyContext,
  ProviderDiscoveryContext,
  ProviderFailoverErrorContext,
  ProviderFetchUsageSnapshotContext,
  ProviderModernModelPolicyContext,
  ProviderNormalizeConfigContext,
  ProviderNormalizeToolSchemasContext,
  ProviderNormalizeTransportContext,
  ProviderResolveConfigApiKeyContext,
  ProviderNormalizeModelIdContext,
  ProviderNormalizeResolvedModelContext,
  ProviderPrepareDynamicModelContext,
  ProviderPrepareExtraParamsContext,
  ProviderPrepareRuntimeAuthContext,
  ProviderPreparedRuntimeAuth,
  ProviderReasoningOutputMode,
  ProviderReasoningOutputModeContext,
  ProviderReplayPolicy,
  ProviderReplayPolicyContext,
  ProviderReplaySessionEntry,
  ProviderReplaySessionState,
  RealtimeTranscriptionProviderPlugin,
  ProviderResolvedUsageAuth,
  ProviderResolveDynamicModelContext,
  ProviderResolveTransportTurnStateContext,
  ProviderResolveWebSocketSessionPolicyContext,
  ProviderSanitizeReplayHistoryContext,
  ProviderTransportTurnState,
  ProviderToolSchemaDiagnostic,
  ProviderResolveUsageAuthContext,
  ProviderThinkingPolicyContext,
  ProviderValidateReplayTurnsContext,
  ProviderWebSocketSessionPolicy,
  ProviderWrapStreamFnContext,
  SpeechProviderPlugin,
  PluginCommandContext,
} from "../plugins/types.js";
import { createCachedLazyValueGetter } from "./lazy-value.js";

export type {
  AnyAgentTool,
  AgentHarness,
  MediaUnderstandingProviderPlugin,
  WineryClawPluginApi,
  WineryClawPluginNodeHostCommand,
  WineryClawPluginReloadRegistration,
  WineryClawPluginSecurityAuditCollector,
  WineryClawPluginSecurityAuditContext,
  WineryClawPluginToolContext,
  WineryClawPluginToolFactory,
  PluginCommandContext,
  WineryClawPluginConfigSchema,
  ProviderDiscoveryContext,
  ProviderCatalogContext,
  ProviderCatalogResult,
  ProviderDeferSyntheticProfileAuthContext,
  ProviderAugmentModelCatalogContext,
  ProviderApplyConfigDefaultsContext,
  ProviderBuiltInModelSuppressionContext,
  ProviderBuiltInModelSuppressionResult,
  ProviderBuildMissingAuthMessageContext,
  ProviderBuildUnknownModelHintContext,
  ProviderCacheTtlEligibilityContext,
  ProviderDefaultThinkingPolicyContext,
  ProviderFetchUsageSnapshotContext,
  ProviderFailoverErrorContext,
  ProviderModernModelPolicyContext,
  ProviderNormalizeConfigContext,
  ProviderNormalizeToolSchemasContext,
  ProviderNormalizeTransportContext,
  ProviderResolveConfigApiKeyContext,
  ProviderNormalizeModelIdContext,
  ProviderReplayPolicy,
  ProviderReplayPolicyContext,
  ProviderReplaySessionEntry,
  ProviderReplaySessionState,
  ProviderPreparedRuntimeAuth,
  ProviderReasoningOutputMode,
  ProviderReasoningOutputModeContext,
  ProviderResolvedUsageAuth,
  ProviderToolSchemaDiagnostic,
  ProviderPrepareExtraParamsContext,
  ProviderPrepareDynamicModelContext,
  ProviderPrepareRuntimeAuthContext,
  ProviderSanitizeReplayHistoryContext,
  ProviderResolveUsageAuthContext,
  ProviderResolveDynamicModelContext,
  ProviderResolveTransportTurnStateContext,
  ProviderResolveWebSocketSessionPolicyContext,
  ProviderNormalizeResolvedModelContext,
  RealtimeTranscriptionProviderPlugin,
  ProviderTransportTurnState,
  SpeechProviderPlugin,
  ProviderThinkingPolicyContext,
  ProviderValidateReplayTurnsContext,
  ProviderWebSocketSessionPolicy,
  ProviderWrapStreamFnContext,
  WineryClawPluginService,
  WineryClawPluginServiceContext,
  ProviderAuthContext,
  ProviderAuthDoctorHintContext,
  ProviderAuthMethodNonInteractiveContext,
  ProviderAuthMethod,
  ProviderAuthResult,
  WineryClawPluginCommandDefinition,
  WineryClawPluginDefinition,
  PluginLogger,
};
export type { ProviderRuntimeModel } from "../plugins/provider-runtime-model.types.js";
export type { WineryClawConfig };

export { buildPluginConfigSchema, emptyPluginConfigSchema } from "../plugins/config-schema.js";

/** Options for a plugin entry that registers providers, tools, commands, or services. */
type DefinePluginEntryOptions = {
  id: string;
  name: string;
  description: string;
  kind?: WineryClawPluginDefinition["kind"];
  configSchema?: WineryClawPluginConfigSchema | (() => WineryClawPluginConfigSchema);
  reload?: WineryClawPluginDefinition["reload"];
  nodeHostCommands?: WineryClawPluginDefinition["nodeHostCommands"];
  securityAuditCollectors?: WineryClawPluginDefinition["securityAuditCollectors"];
  register: (api: WineryClawPluginApi) => void;
};

/** Normalized object shape that WineryClaw loads from a plugin entry module. */
type DefinedPluginEntry = {
  id: string;
  name: string;
  description: string;
  configSchema: WineryClawPluginConfigSchema;
  register: NonNullable<WineryClawPluginDefinition["register"]>;
} & Pick<
  WineryClawPluginDefinition,
  "kind" | "reload" | "nodeHostCommands" | "securityAuditCollectors"
>;

/**
 * Canonical entry helper for non-channel plugins.
 *
 * Use this for provider, tool, command, service, memory, and context-engine
 * plugins. Channel plugins should use `defineChannelPluginEntry(...)` from
 * `openclaw/plugin-sdk/core` so they inherit the channel capability wiring.
 */
export function definePluginEntry({
  id,
  name,
  description,
  kind,
  configSchema = emptyPluginConfigSchema,
  reload,
  nodeHostCommands,
  securityAuditCollectors,
  register,
}: DefinePluginEntryOptions): DefinedPluginEntry {
  const getConfigSchema = createCachedLazyValueGetter(configSchema);
  return {
    id,
    name,
    description,
    ...(kind ? { kind } : {}),
    ...(reload ? { reload } : {}),
    ...(nodeHostCommands ? { nodeHostCommands } : {}),
    ...(securityAuditCollectors ? { securityAuditCollectors } : {}),
    get configSchema() {
      return getConfigSchema();
    },
    register,
  };
}
