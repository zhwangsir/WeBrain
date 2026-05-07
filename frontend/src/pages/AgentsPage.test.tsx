/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AgentsPage from "./AgentsPage";

vi.mock("../stores/agentStore", () => ({
  useAgentStore: () => ({
    agents: [
      { id: "a1", name: "Agent One", description: "d1", enabled: true },
      { id: "a2", name: "Agent Two", description: "d2", enabled: false },
    ],
    fetchAgents: vi.fn(),
  }),
}));

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders agent page shell", () => {
    render(
      <BrowserRouter>
        <AgentsPage />
      </BrowserRouter>
    );

    expect(screen.getByText("智能体")).toBeInTheDocument();
    expect(screen.getByText("管理 AI 智能体与代理任务")).toBeInTheDocument();
  });

  it("renders agent list", () => {
    render(
      <BrowserRouter>
        <AgentsPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Agent One")).toBeInTheDocument();
    expect(screen.getByText("Agent Two")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    render(
      <BrowserRouter>
        <AgentsPage />
      </BrowserRouter>
    );

    expect(screen.getByText("正常")).toBeInTheDocument();
    expect(screen.getByText("未连接")).toBeInTheDocument();
  });
});
