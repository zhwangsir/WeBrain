import { describe, expect, it } from "vitest";
import type { WineryClawConfig } from "../config/config.js";
import { isUpdatePlanToolEnabledForWineryClawTools } from "./openclaw-tools.registration.js";
import { createUpdatePlanTool } from "./tools/update-plan-tool.js";

describe("openclaw-tools update_plan gating", () => {
  it("keeps update_plan disabled by default", () => {
    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: {} as WineryClawConfig,
      }),
    ).toBe(false);
  });

  it("registers update_plan when explicitly enabled", () => {
    const config = {
      tools: {
        experimental: {
          planTool: true,
        },
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config,
      }),
    ).toBe(true);
    expect(createUpdatePlanTool().displaySummary).toBe("Track a short structured work plan.");
  });

  it("does not auto-enable update_plan outside strict-agentic mode", () => {
    const cfg = {
      agents: {
        list: [{ id: "main" }],
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentSessionKey: "agent:main:main",
        modelProvider: "openai",
        modelId: "gpt-5.4",
      }),
    ).toBe(false);
  });

  it("auto-enables update_plan for strict-agentic GPT-5 agents", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedPi: {
            executionContract: "strict-agentic",
          },
        },
        list: [{ id: "main" }],
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentSessionKey: "agent:main:main",
        modelProvider: "openai",
        modelId: "gpt-5.4",
      }),
    ).toBe(true);
  });

  it("does not auto-enable update_plan for unsupported providers or models", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedPi: {
            executionContract: "strict-agentic",
          },
        },
        list: [{ id: "main" }],
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentSessionKey: "agent:main:main",
        modelProvider: "anthropic",
        modelId: "claude-opus-4-6",
      }),
    ).toBe(false);
    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentSessionKey: "agent:main:main",
        modelProvider: "openai",
        modelId: "gpt-4.1",
      }),
    ).toBe(false);
  });

  it("lets explicit planTool false override strict-agentic auto-enable", () => {
    const cfg = {
      tools: {
        experimental: {
          planTool: false,
        },
      },
      agents: {
        defaults: {
          embeddedPi: {
            executionContract: "strict-agentic",
          },
        },
        list: [{ id: "main" }],
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentSessionKey: "agent:main:main",
        modelProvider: "openai",
        modelId: "gpt-5.4",
      }),
    ).toBe(false);
  });

  it("resolves strict-agentic gating from explicit agentId when no session key is available", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedPi: {
            executionContract: "default",
          },
        },
        list: [
          { id: "main" },
          {
            id: "research",
            embeddedPi: {
              executionContract: "strict-agentic",
            },
          },
        ],
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentId: "research",
        modelProvider: "openai",
        modelId: "gpt-5.4",
      }),
    ).toBe(true);
  });

  it("applies per-agent overrides without leaking the contract to other agents", () => {
    const cfg = {
      agents: {
        defaults: {
          embeddedPi: {
            executionContract: "strict-agentic",
          },
        },
        list: [
          {
            id: "main",
            embeddedPi: {
              executionContract: "default",
            },
          },
          {
            id: "research",
          },
        ],
      },
    } as WineryClawConfig;

    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentId: "main",
        modelProvider: "openai",
        modelId: "gpt-5.4",
      }),
    ).toBe(false);
    expect(
      isUpdatePlanToolEnabledForWineryClawTools({
        config: cfg,
        agentId: "research",
        modelProvider: "openai",
        modelId: "gpt-5.4",
      }),
    ).toBe(true);
  });
});
