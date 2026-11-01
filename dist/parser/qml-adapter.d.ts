import { NormalizedLayer } from "./sketch-parser.js";
export interface QmlGeometryProps {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface QmlTextProps {
    text: string;
    color: string;
    pixelSize: number;
    fontFamily?: string;
    fontWeight: string;
    lineHeight?: number;
}
export interface QmlRectangleProps {
    color: string;
    radius: number;
    borderWidth: number;
    borderColor: string;
    opacity?: number;
}
export interface QmlImageProps {
    source: string;
    sliceName: string;
    format: string;
    fillMode: string;
}
export interface QmlLayerDetails {
    id: string;
    name: string;
    type: NormalizedLayer["type"];
    geometry: {
        absolute: QmlGeometryProps;
        relative: QmlGeometryProps;
    };
    qmlType: "Text" | "Rectangle" | "Image" | "Item";
    textProps?: QmlTextProps;
    rectProps?: QmlRectangleProps;
    imageProps?: QmlImageProps;
    qmlSnippet: string;
}
export declare class QmlAdapter {
    /**
     * 将数字或名称权重映射为 QML Font.Weight 枚举字符
     */
    static mapFontWeight(weight: any): string;
    /**
     * 生成 QML 适配详情与代码片段
     */
    static adapt(layer: NormalizedLayer, options?: {
        useAbsoluteCoords?: boolean;
        assetsFolder?: string;
    }): QmlLayerDetails;
    /**
     * 将图层名清理为合法的 QML ID（驼峰或下划线，去除特殊符号与以数字开头）
     */
    static sanitizeId(name: string): string;
}
//# sourceMappingURL=qml-adapter.d.ts.map