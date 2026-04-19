export type {
  ChannelConfigUiHint,
  ChannelPlugin,
  WineryClawConfig,
  WineryClawPluginApi,
  PluginCommandContext,
  PluginRuntime,
  ChannelOutboundSessionRouteParams,
} from "./core.js";

import { createChannelPluginBase as createChannelPluginBaseFromCore } from "./core.js";

export const createChannelPluginBase: typeof createChannelPluginBaseFromCore = (params) =>
  createChannelPluginBaseFromCore(params);

export {
  buildChannelConfigSchema,
  buildChannelOutboundSessionRoute,
  clearAccountEntryFields,
  createChatChannelPlugin,
  defineChannelPluginEntry,
  defineSetupPluginEntry,
  parseOptionalDelimitedEntries,
  stripChannelTargetPrefix,
  stripTargetKindPrefix,
  tryReadSecretFileSync,
} from "./core.js";
