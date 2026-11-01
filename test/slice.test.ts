import { describe, it, expect, vi, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SliceService, DownloadSliceItem } from "../src/services/slice-service.js";
import { ParsedArtboard } from "../src/parser/sketch-parser.js";

describe("SliceService", () => {
  const tempDownloadDir = path.join(os.tmpdir(), `test-lanhu-slices-${Date.now()}`);

  afterEach(() => {
    if (fs.existsSync(tempDownloadDir)) {
      fs.rmSync(tempDownloadDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("应正确去重并提取画板中的切片项", () => {
    const mockArtboard: ParsedArtboard = {
      id: "ab1",
      name: "画板",
      width: 100,
      height: 100,
      rootLayers: [],
      layerMap: new Map(),
      slices: [
        {
          id: "s1",
          layerId: "l1",
          name: "icon/search",
          format: "png",
          scale: "1x",
          url: "https://oss/search.png",
        },
        {
          id: "s2",
          layerId: "l2",
          name: "icon/search_duplicate",
          format: "png",
          scale: "1x",
          url: "https://oss/search.png", // 相同 URL 应被去重
        },
        {
          id: "s3",
          layerId: "l3",
          name: "logo",
          format: "svg",
          scale: "1x",
          url: "https://oss/logo.svg",
        },
      ],
    };

    const extracted = SliceService.extractSlices(mockArtboard);
    expect(extracted.length).toBe(2);
    expect(extracted[0].name).toBe("icon_search"); // 斜杠被 sanitize 成下划线
    expect(extracted[1].name).toBe("logo");
  });

  it("应成功下载指定切图并保存到本地目录", async () => {
    const mockSlices: DownloadSliceItem[] = [
      {
        id: "s1",
        name: "btn_icon",
        format: "png",
        scale: "1x",
        url: "https://oss/btn_icon.png",
        layerId: "l1",
      },
    ];

    // Mock fetch
    const mockBinary = new TextEncoder().encode("fake-png-binary-data");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      arrayBuffer: async () => mockBinary.buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await SliceService.downloadSlices({
      slices: mockSlices,
      outputDir: tempDownloadDir,
    });

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].fileName).toBe("btn_icon.png");

    const savedFile = path.join(tempDownloadDir, "btn_icon.png");
    expect(fs.existsSync(savedFile)).toBe(true);
    expect(fs.readFileSync(savedFile).toString()).toBe("fake-png-binary-data");
  });
});
