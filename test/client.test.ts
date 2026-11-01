import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { ConfigStore } from "../src/client/config-store.js";
import { LanhuApiClient } from "../src/client/lanhu-api.js";

describe("ConfigStore", () => {
  const tempConfigPath = path.join(os.tmpdir(), `test-gemini-lanhu-${Date.now()}.json`);

  afterEach(() => {
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  });

  it("应正确保存和读取 Cookie", () => {
    const store = new ConfigStore(tempConfigPath);
    expect(store.getCookie()).toBeUndefined();

    store.setCookie("test_cookie_value");
    expect(store.getCookie()).toBe("test_cookie_value");

    const reloaded = new ConfigStore(tempConfigPath);
    expect(reloaded.getCookie()).toBe("test_cookie_value");
  });
});

describe("LanhuApiClient.parseUrl", () => {
  const client = new LanhuApiClient();

  it("应成功解析标准蓝湖 board 详情链接", () => {
    const url =
      "https://lanhuapp.com/web/#/item/project/board/detail?pid=proj123&project_id=proj123&image_id=img456&team_id=team789";
    const parsed = client.parseUrl(url);
    expect(parsed.projectId).toBe("proj123");
    expect(parsed.imageId).toBe("img456");
    expect(parsed.teamId).toBe("team789");
  });

  it("应成功解析 detailDetach 分离模式详情链接", () => {
    const url =
      "https://lanhuapp.com/web/#/item/project/detailDetach?tid=team999&pid=proj888&image_id=img777";
    const parsed = client.parseUrl(url);
    expect(parsed.projectId).toBe("proj888");
    expect(parsed.imageId).toBe("img777");
    expect(parsed.teamId).toBe("team999");
  });

  it("应解析带有 docId 和 version_id 的链接", () => {
    const url =
      "https://lanhuapp.com/web/#/item/project/board/detail?project_id=p1&docId=d2&version_id=v3";
    const parsed = client.parseUrl(url);
    expect(parsed.projectId).toBe("p1");
    expect(parsed.imageId).toBe("d2");
    expect(parsed.versionId).toBe("v3");
  });

  it("缺失 pid 或 imageId 时应抛出异常", () => {
    expect(() => client.parseUrl("https://lanhuapp.com/web/#/item/project/stage?tid=123")).toThrow(
      "无法从 URL 中解析出有效"
    );
  });
});
