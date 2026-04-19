export type McpLoopbackRuntime = {
  port: number;
  token: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

export function clearActiveMcpLoopbackRuntime(token: string): void {
  if (activeRuntime?.token === token) {
    activeRuntime = undefined;
  }
}

export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      openclaw: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${WINERYCLAW_MCP_TOKEN}",
          "x-session-key": "${WINERYCLAW_MCP_SESSION_KEY}",
          "x-openclaw-agent-id": "${WINERYCLAW_MCP_AGENT_ID}",
          "x-openclaw-account-id": "${WINERYCLAW_MCP_ACCOUNT_ID}",
          "x-openclaw-message-channel": "${WINERYCLAW_MCP_MESSAGE_CHANNEL}",
          "x-openclaw-sender-is-owner": "${WINERYCLAW_MCP_SENDER_IS_OWNER}",
        },
      },
    },
  };
}
