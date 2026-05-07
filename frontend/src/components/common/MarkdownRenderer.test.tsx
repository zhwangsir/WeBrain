import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MarkdownRenderer from "./MarkdownRenderer";

vi.mock("../../hooks/useTheme", () => ({
  useIsDark: () => false,
}));

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe("MarkdownRenderer", () => {
  it("renders plain text", () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders inline code", () => {
    render(<MarkdownRenderer content="Use `console.log` to debug" />);
    expect(screen.getByText("console.log")).toBeInTheDocument();
  });

  it("renders links with target=_blank", () => {
    render(<MarkdownRenderer content="[Link](https://example.com)" />);
    const link = screen.getByRole("link", { name: "Link" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders empty content gracefully", () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.textContent).toBe("");
  });

  it("applies custom className", () => {
    const { container } = render(<MarkdownRenderer content="test" className="my-class" />);
    expect(container.querySelector(".my-class")).toBeInTheDocument();
  });
});
