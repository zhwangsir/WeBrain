#!/usr/bin/env node
/**
 * Fake MCP server for testing.
 * Reads JSON-RPC lines from stdin and writes responses to stdout.
 */

const tools = [
  {
    name: "greet",
    description: "Say hello",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
    },
  },
];

function send(msg) {
  console.log(JSON.stringify(msg));
}

const rl = require("readline").createInterface({ input: process.stdin });

rl.on("line", (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }

  if (req.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        serverInfo: { name: "fake-mcp", version: "1.0.0" },
      },
    });
  } else if (req.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: { tools },
    });
  } else if (req.method === "tools/call") {
    const name = req.params?.arguments?.name || "world";
    send({
      jsonrpc: "2.0",
      id: req.id,
      result: {
        content: [{ type: "text", text: `Hello from fake MCP, ${name}!` }],
      },
    });
  }
});

// Keep the process alive
setInterval(() => {}, 60000);
