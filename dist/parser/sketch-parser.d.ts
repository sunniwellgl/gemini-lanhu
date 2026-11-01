export interface RectFrame {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface LayerColor {
    r: number;
    g: number;
    b: number;
    a: number;
    hex: string;
    hexWithAlpha: string;
    rgbaCss: string;
    qtRgba: string;
}
export interface TextTypography {
    text: string;
    fontSize: number;
    fontFamily?: string;
    fontWeight?: number | string;
    lineHeight?: number;
    textAlign?: "left" | "center" | "right";
    color?: LayerColor;
}
export interface ExportSliceAsset {
    id: string;
    layerId: string;
    name: string;
    format: string;
    scale: string;
    url: string;
    width?: number;
    height?: number;
}
export interface NormalizedLayer {
    id: string;
    name: string;
    type: "text" | "rectangle" | "group" | "slice" | "image" | "shape" | "other";
    rawClass: string;
    isVisible: boolean;
    isLocked: boolean;
    relativeFrame: RectFrame;
    absoluteFrame: RectFrame;
    parentId?: string;
    childrenIds: string[];
    depth: number;
    backgroundColor?: LayerColor;
    borderColor?: LayerColor;
    borderWidth?: number;
    borderRadius?: number;
    opacity?: number;
    typography?: TextTypography;
    isSlice: boolean;
    exportAssets: ExportSliceAsset[];
    rawNode?: any;
}
export interface ParsedArtboard {
    id: string;
    name: string;
    width: number;
    height: number;
    rootLayers: NormalizedLayer[];
    layerMap: Map<string, NormalizedLayer>;
    slices: ExportSliceAsset[];
}
export declare class SketchParser {
    /**
     * 将任意 RGBA（支持 0-1 浮点、0-255 整数或 rgba 字符串）转换为标准规范化颜色对象
     */
    static parseColor(rawColor: any): LayerColor | undefined;
    /**
     * 解析蓝湖全量 Schema JSON（兼容原生 Sketch 嵌套树与蓝湖 DDS 扁平索引结构）
     */
    parse(schema: any, fallbackMeta?: {
        width?: number;
        height?: number;
        name?: string;
    }): ParsedArtboard;
    /**
     * 专门解析蓝湖 DDS 格式结构
     */
    private parseDdsSchema;
    private traverseLayer;
}
export declare const defaultSketchParser: SketchParser;
//# sourceMappingURL=sketch-parser.d.ts.map