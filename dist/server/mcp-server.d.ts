import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConfigStore } from "../client/config-store.js";
import { LanhuApiClient } from "../client/lanhu-api.js";
import { SketchParser } from "../parser/sketch-parser.js";
export declare function createLanhuMcpServer(options?: {
    configStore?: ConfigStore;
    apiClient?: LanhuApiClient;
    parser?: SketchParser;
}): McpServer;
//# sourceMappingURL=mcp-server.d.ts.map