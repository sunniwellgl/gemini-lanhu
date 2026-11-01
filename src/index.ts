#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLanhuMcpServer } from "./server/mcp-server.js";

async function main() {
  const server = createLanhuMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gemini Lanhu MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting gemini-lanhu MCP server:", err);
  process.exit(1);
});
