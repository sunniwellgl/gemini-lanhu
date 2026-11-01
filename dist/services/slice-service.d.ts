import { ParsedArtboard } from "../parser/sketch-parser.js";
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
export declare class SliceService {
    /**
     * 汇总画板中的所有切片资产
     */
    static extractSlices(artboard: ParsedArtboard): DownloadSliceItem[];
    /**
     * 下载切图资产并保存至本地目录
     */
    static downloadSlices(options: {
        slices: DownloadSliceItem[];
        outputDir: string;
        filterNames?: string[];
        formats?: string[];
        platform?: SlicePlatform;
        overwrite?: boolean;
    }): Promise<DownloadResult[]>;
    /**
     * 将切图名称规范化为合法的文件名（下划线连接，去除非法特殊字符）
     */
    static sanitizeFileName(name: string): string;
}
//# sourceMappingURL=slice-service.d.ts.map