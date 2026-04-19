import { createAcpxRuntimeService } from "./register.runtime.js";
import { tryDispatchAcpReplyHook, type WineryClawPluginApi } from "./runtime-api.js";
import { createAcpxPluginConfigSchema } from "./src/config-schema.js";

const plugin = {
  id: "acpx",
  name: "ACPX Runtime",
  description: "Embedded ACP runtime backend with plugin-owned session and transport management.",
  configSchema: () => createAcpxPluginConfigSchema(),
  register(api: WineryClawPluginApi) {
    api.registerService(
      createAcpxRuntimeService({
        pluginConfig: api.pluginConfig,
      }),
    );
    api.on("reply_dispatch", tryDispatchAcpReplyHook);
  },
};

export default plugin;
