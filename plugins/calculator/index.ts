/**
 * Calculator Plugin — WeBrain Plugin SDK v1 Example
 */

import type { PluginContext, ToolDefinition } from "../../sub-brain/src/plugin-sdk/types.js";

const tools: ToolDefinition[] = [
  {
    name: "calculate",
    description: "Evaluate mathematical expressions safely",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Math expression like '2 + 2 * 3'" },
      },
      required: ["expression"],
    },
    runtime: "sub-brain",
    async handler(args, ctx) {
      const expr = String(args.expression).replace(/[^0-9+\-*/().\s]/g, "");
      try {
        // eslint-disable-next-line no-eval
        const result = eval(expr);
        return { result, expression: expr };
      } catch (e: any) {
        return { error: "Invalid expression", expression: expr };
      }
    },
  },
];

export default {
  async onLoad(ctx: PluginContext) {
    ctx.logger.info("Calculator plugin loaded");
    for (const tool of tools) {
      ctx.tools.register(tool);
    }
  },
  async onUnload(ctx: PluginContext) {
    ctx.logger.info("Calculator plugin unloaded");
  },
  tools,
};
