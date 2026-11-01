"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SliceService = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
class SliceService {
    /**
     * 汇总画板中的所有切片资产
     */
    static extractSlices(artboard) {
        const list = [];
        const seenKeys = new Set();
        for (const slice of artboard.slices) {
            if (!slice.url)
                continue;
            const key = `${slice.url}_${slice.format}_${slice.scale}`;
            if (seenKeys.has(key))
                continue;
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
    static async downloadSlices(options) {
        const { slices, outputDir, filterNames, formats = ["png"], platform = "web", overwrite = true, } = options;
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
                return (lowerFilters.has(lowerName) ||
                    (s.layerName && lowerFilters.has(s.layerName.toLowerCase())));
            });
        }
        const results = [];
        for (const slice of candidates) {
            const cleanName = this.sanitizeFileName(slice.name);
            const ext = slice.format.startsWith(".") ? slice.format.substring(1) : slice.format;
            let subDir = "";
            let fileName = `${cleanName}.${ext}`;
            if (platform === "web" || platform === "ios") {
                if (slice.scale === "2x" || slice.scale === "@2x") {
                    fileName = `${cleanName}@2x.${ext}`;
                }
                else if (slice.scale === "3x" || slice.scale === "@3x") {
                    fileName = `${cleanName}@3x.${ext}`;
                }
                else {
                    fileName = `${cleanName}.${ext}`;
                }
            }
            else if (platform === "android") {
                if (slice.scale === "1x")
                    subDir = "mipmap-mdpi";
                else if (slice.scale === "1.5x")
                    subDir = "mipmap-hdpi";
                else if (slice.scale === "2x")
                    subDir = "mipmap-xhdpi";
                else if (slice.scale === "3x")
                    subDir = "mipmap-xxhdpi";
                else if (slice.scale === "4x")
                    subDir = "mipmap-xxxhdpi";
                else
                    subDir = "mipmap-mdpi";
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
            }
            catch (err) {
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
    static sanitizeFileName(name) {
        let clean = name.trim().replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_");
        if (!clean)
            clean = "slice_asset";
        return clean;
    }
}
exports.SliceService = SliceService;
//# sourceMappingURL=slice-service.js.map