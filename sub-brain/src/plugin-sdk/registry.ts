/**
 * WeBrain Plugin Registry — manages plugin lifecycle
 */

import type { PluginManifest, LoadedPlugin, PluginContext, ToolDefinition } from "./types.js";
import { createPluginContext } from "./context.js";

export class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>();
  private toolIndex = new Map<string, { tool: ToolDefinition; pluginId: string }>();

  async load(manifest: PluginManifest, module: any): Promise<LoadedPlugin> {
    const pluginId = manifest.id;

    // Unload existing if present
    if (this.plugins.has(pluginId)) {
      await this.unload(pluginId);
    }

    const context = createPluginContext(manifest, this);
    const plugin: LoadedPlugin = { manifest, context, module, enabled: false };

    this.plugins.set(pluginId, plugin);

    // Call onLoad if exists
    if (module.default?.onLoad) {
      await module.default.onLoad(context);
    }

    // Register tools
    if (module.default?.tools) {
      for (const tool of module.default.tools) {
        this.registerTool(pluginId, tool);
      }
    }

    plugin.enabled = true;
    console.log(`[plugin-sdk] Loaded ${pluginId} v${manifest.version}`);
    return plugin;
  }

  async unload(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    plugin.enabled = false;

    // Call onUnload
    if (plugin.module?.default?.onUnload) {
      await plugin.module.default.onUnload(plugin.context);
    }

    // Unregister tools
    for (const [name, entry] of this.toolIndex) {
      if (entry.pluginId === pluginId) {
        this.toolIndex.delete(name);
      }
    }

    this.plugins.delete(pluginId);
    console.log(`[plugin-sdk] Unloaded ${pluginId}`);
  }

  registerTool(pluginId: string, tool: ToolDefinition): void {
    this.toolIndex.set(tool.name, { tool, pluginId });
    console.log(`[plugin-sdk] Tool registered: ${tool.name} from ${pluginId}`);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.toolIndex.get(name)?.tool;
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.toolIndex.values()).map((e) => e.tool);
  }

  listPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }
}
