#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const mcp_server_js_1 = require("./server/mcp-server.js");
async function main() {
    const server = (0, mcp_server_js_1.createLanhuMcpServer)();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Gemini Lanhu MCP Server running on stdio");
}
main().catch((err) => {
    console.error("Fatal error starting gemini-lanhu MCP server:", err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map