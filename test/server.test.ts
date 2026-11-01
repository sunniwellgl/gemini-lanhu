import { describe, it, expect, vi } from "vitest";
import { createLanhuMcpServer } from "../src/server/mcp-server.js";
import { ConfigStore } from "../src/client/config-store.js";
import { LanhuApiClient } from "../src/client/lanhu-api.js";
import { SketchParser } from "../src/parser/sketch-parser.js";

describe("LanhuMcpServer", () => {
  it("应成功实例化 MCP Server", () => {
    const server = createLanhuMcpServer();
    expect(server).toBeDefined();
  });

  it("工具解析蓝湖 URL 应返回正确的项目参数", async () => {
    const configStore = new ConfigStore();
    const apiClient = new LanhuApiClient(configStore);
    const parser = new SketchParser();

    const server = createLanhuMcpServer({ configStore, apiClient, parser });
    expect(server).toBeDefined();

    // 验证 url 解析
    const parsed = apiClient.parseUrl(
      "https://lanhuapp.com/web/#/item/project/board/detail?pid=project_abc&image_id=image_def"
    );
    expect(parsed.projectId).toBe("project_abc");
    expect(parsed.imageId).toBe("image_def");
  });
});
