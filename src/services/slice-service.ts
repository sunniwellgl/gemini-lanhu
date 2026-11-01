import * as fs from "node:fs";
import * as path from "node:path";
import { ExportSliceAsset, ParsedArtboard } from "../parser/sketch-parser.js";

export interface DownloadSliceItem {
  id: string;
  name: string;
  format: string;
  scale: string;
  url: string;
  width?: number;
  height?: number;
  layerId: string;
  layerName?: string;
}

export interface DownloadResult {
  name: string;
  format: string;
  scale: string;
  fileName: string;
  localAbsolutePath: string;
  localRelativePath: string;
  sizeBytes: number;
  success: boolean;
  error?: string;
}

export type SlicePlatform = "web" | "ios" | "android";

export class SliceService {
  /**
   * 汇总画板中的所有切片资产
   */
  public static extractSlices(artboard: ParsedArtboard): DownloadSliceItem[] {
    const list: DownloadSliceItem[] = [];
    const seenKeys = new Set<string>();

    for (const slice of artboard.slices) {
      if (!slice.url) continue;
      const key = `${slice.url}_${slice.format}_${slice.scale}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const layer = artboard.layerMap.get(slice.layerId);
      list.push({
        id: slice.id,
        name: this.sanitizeFileName(slice.name || layer?.name || "slice"),
        format: (slice.format || "png").toLowerCase(),
        scale: slice.scale || "1x",
        url: slice.url,
        width: slice.width,
        height: slice.height,
        layerId: slice.layerId,
        layerName: layer?.name,
      });
    }

    return list;
  }

  /**
   * 下载切图资产并保存至本地目录
   */
  public static async downloadSlices(options: {
    slices: DownloadSliceItem[];
    outputDir: string;
    filterNames?: string[];
    formats?: string[];
    platform?: SlicePlatform;
    overwrite?: boolean;
  }): Promise<DownloadResult[]> {
    const {
      slices,
      outputDir,
      filterNames,
      formats = ["png"],
      platform = "web",
      overwrite = true,
    } = options;

    const resolvedOutputDir = path.resolve(outputDir);
    if (!fs.existsSync(resolvedOutputDir)) {
      fs.mkdirSync(resolvedOutputDir, { recursive: true });
    }

    // 格式过滤（如仅导出 png）
    let candidates = slices;
    if (formats && formats.length > 0) {
      const formatSet = new Set(formats.map((f) => f.toLowerCase().replace(/^\./, "")));
      candidates = candidates.filter((s) => formatSet.has(s.format.toLowerCase()));
    }

    // 名称过滤
    if (filterNames && filterNames.length > 0) {
      const lowerFilters = new Set(filterNames.map((n) => n.toLowerCase().trim()));
      candidates = candidates.filter((s) => {
        const lowerName = s.name.toLowerCase();
        return (
          lowerFilters.has(lowerName) ||
          (s.layerName && lowerFilters.has(s.layerName.toLowerCase()))
        );
      });
    }

    const results: DownloadResult[] = [];

    for (const slice of candidates) {
      const cleanName = this.sanitizeFileName(slice.name);
      const ext = slice.format.startsWith(".") ? slice.format.substring(1) : slice.format;

      let subDir = "";
      let fileName = `${cleanName}.${ext}`;

      if (platform === "web" || platform === "ios") {
        if (slice.scale === "2x" || slice.scale === "@2x") {
          fileName = `${cleanName}@2x.${ext}`;
        } else if (slice.scale === "3x" || slice.scale === "@3x") {
          fileName = `${cleanName}@3x.${ext}`;
        } else {
          fileName = `${cleanName}.${ext}`;
        }
      } else if (platform === "android") {
        if (slice.scale === "1x") subDir = "mipmap-mdpi";
        else if (slice.scale === "1.5x") subDir = "mipmap-hdpi";
        else if (slice.scale === "2x") subDir = "mipmap-xhdpi";
        else if (slice.scale === "3x") subDir = "mipmap-xxhdpi";
        else if (slice.scale === "4x") subDir = "mipmap-xxxhdpi";
        else subDir = "mipmap-mdpi";
      }

      const targetDir = subDir ? path.join(resolvedOutputDir, subDir) : resolvedOutputDir;
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, fileName);
      const relativePath = path.relative(process.cwd(), filePath);

      if (!overwrite && fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        results.push({
          name: slice.name,
          format: ext,
          scale: slice.scale,
          fileName: subDir ? `${subDir}/${fileName}` : fileName,
          localAbsolutePath: filePath,
          localRelativePath: relativePath,
          sizeBytes: stat.size,
          success: true,
        });
        continue;
      }

      try {
        const res = await fetch(slice.url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);

        results.push({
          name: slice.name,
          format: ext,
          scale: slice.scale,
          fileName: subDir ? `${subDir}/${fileName}` : fileName,
          localAbsolutePath: filePath,
          localRelativePath: relativePath,
          sizeBytes: buffer.length,
          success: true,
        });
      } catch (err: any) {
        results.push({
          name: slice.name,
          format: ext,
          scale: slice.scale,
          fileName: subDir ? `${subDir}/${fileName}` : fileName,
          localAbsolutePath: filePath,
          localRelativePath: relativePath,
          sizeBytes: 0,
          success: false,
          error: err?.message || String(err),
        });
      }
    }

    return results;
  }

  /**
   * 将切图名称规范化为合法的文件名（下划线连接，去除非法特殊字符）
   */
  public static sanitizeFileName(name: string): string {
    let clean = name.trim().replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_");
    if (!clean) clean = "slice_asset";
    return clean;
  }
}
