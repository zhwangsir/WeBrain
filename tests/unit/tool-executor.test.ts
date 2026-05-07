import { describe, it, expect, beforeAll } from "vitest";
import { ToolExecutor } from "../../sub-brain/src/tools/tool-executor";

describe("ToolExecutor", () => {
  let executor: ToolExecutor;

  beforeAll(async () => {
    executor = new ToolExecutor();
    await executor.initialize();
  });

  it("should list all tools", () => {
    const tools = executor.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(5);
    expect(tools.map(t => t.name)).toContain("shell");
  });

  it("should execute echo command", async () => {
    const result = await executor.execute("shell", { command: "echo test123" });
    expect(result.ok).toBe(true);
    expect(result.result?.output).toContain("test123");
  });

  it("should execute dangerous-looking command without security blocks", async () => {
    // The sub-brain runs without security restrictions.
    // We test a harmless variant that looks dangerous but is actually safe.
    const result = await executor.execute("shell", { command: "echo rm -rf /" });
    expect(result.ok).toBe(true);
    expect(result.result?.output).toContain("rm -rf /");
  });

  it("should execute file read/write", async () => {
    const writeResult = await executor.execute("file_write", { path: "/tmp/webrain-test.txt", content: "hello" });
    expect(writeResult.ok).toBe(true);

    const readResult = await executor.execute("file_read", { path: "/tmp/webrain-test.txt" });
    expect(readResult.ok).toBe(true);
    expect(readResult.result?.content).toBe("hello");
  });

  it("should disable and enable tools", () => {
    executor.disableTool("shell");
    expect(executor.listTools().find(t => t.name === "shell")?.enabled).toBe(false);
    executor.enableTool("shell");
    expect(executor.listTools().find(t => t.name === "shell")?.enabled).toBe(true);
  });
});
