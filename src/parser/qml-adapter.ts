import { NormalizedLayer, RectFrame } from "./sketch-parser.js";

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
  fontWeight: string; // Font.Normal, Font.Bold, Font.Medium...
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

export class QmlAdapter {
  /**
   * 将数字或名称权重映射为 QML Font.Weight 枚举字符
   */
  public static mapFontWeight(weight: any): string {
    if (!weight) return "Font.Normal";
    const w = String(weight).toLowerCase();
    if (w.includes("bold") || w === "700" || w === "800" || w === "900") {
      return "Font.Bold";
    }
    if (w.includes("medium") || w === "500" || w === "600") {
      return "Font.Medium";
    }
    if (w.includes("light") || w === "300") {
      return "Font.Light";
    }
    if (w.includes("thin") || w === "100" || w === "200") {
      return "Font.Thin";
    }
    return "Font.Normal";
  }

  /**
   * 生成 QML 适配详情与代码片段
   */
  public static adapt(
    layer: NormalizedLayer,
    options: {
      useAbsoluteCoords?: boolean;
      assetsFolder?: string;
    } = {}
  ): QmlLayerDetails {
    const useAbsolute = options.useAbsoluteCoords ?? true;
    const assetsFolder = options.assetsFolder || "images";

    const geom = useAbsolute ? layer.absoluteFrame : layer.relativeFrame;
    const x = Math.round(geom.x);
    const y = Math.round(geom.y);
    const width = Math.round(geom.width);
    const height = Math.round(geom.height);

    let qmlType: QmlLayerDetails["qmlType"] = "Item";
    let textProps: QmlTextProps | undefined;
    let rectProps: QmlRectangleProps | undefined;
    let imageProps: QmlImageProps | undefined;

    const lines: string[] = [];

    if (layer.type === "text" && layer.typography) {
      qmlType = "Text";
      const color =
        layer.typography.color?.a !== undefined && layer.typography.color.a < 1
          ? layer.typography.color.hexWithAlpha
          : layer.typography.color?.hex || "#000000";

      textProps = {
        text: layer.typography.text,
        color,
        pixelSize: Math.round(layer.typography.fontSize),
        fontFamily: layer.typography.fontFamily,
        fontWeight: this.mapFontWeight(layer.typography.fontWeight),
        lineHeight: layer.typography.lineHeight,
      };

      lines.push(`Text {`);
      lines.push(`    id: ${this.sanitizeId(layer.name)}`);
      lines.push(`    x: ${x}`);
      lines.push(`    y: ${y}`);
      lines.push(`    width: ${width}`);
      lines.push(`    height: ${height}`);
      lines.push(`    text: qsTr(${JSON.stringify(textProps.text)})`);
      lines.push(`    color: "${textProps.color}"`);
      lines.push(`    font.pixelSize: ${textProps.pixelSize}`);
      if (textProps.fontFamily) {
        lines.push(`    font.family: "${textProps.fontFamily}"`);
      }
      if (textProps.fontWeight !== "Font.Normal") {
        lines.push(`    font.weight: ${textProps.fontWeight}`);
      }
      lines.push(`}`);
    } else if (layer.type === "slice") {
      qmlType = "Image";
      const sliceAsset = layer.exportAssets[0];
      const sliceName = sliceAsset?.name || this.sanitizeId(layer.name);
      const format = sliceAsset?.format || "png";
      const source = `${assetsFolder}/${sliceName}.${format}`;

      imageProps = {
        source,
        sliceName,
        format,
        fillMode: "Image.PreserveAspectFit",
      };

      lines.push(`Image {`);
      lines.push(`    id: ${this.sanitizeId(layer.name)}`);
      lines.push(`    x: ${x}`);
      lines.push(`    y: ${y}`);
      lines.push(`    width: ${width}`);
      lines.push(`    height: ${height}`);
      lines.push(`    source: "${source}"`);
      lines.push(`    fillMode: Image.PreserveAspectFit`);
      lines.push(`}`);
    } else if (layer.type === "rectangle" || layer.backgroundColor || layer.borderColor) {
      qmlType = "Rectangle";
      const color = layer.backgroundColor
        ? layer.backgroundColor.a < 1
          ? layer.backgroundColor.hexWithAlpha
          : layer.backgroundColor.hex
        : "transparent";

      const borderColor = layer.borderColor
        ? layer.borderColor.a < 1
          ? layer.borderColor.hexWithAlpha
          : layer.borderColor.hex
        : "transparent";

      rectProps = {
        color,
        radius: Math.round(layer.borderRadius || 0),
        borderWidth: Math.round(layer.borderWidth || 0),
        borderColor,
        opacity: layer.opacity !== undefined && layer.opacity < 1 ? layer.opacity : undefined,
      };

      lines.push(`Rectangle {`);
      lines.push(`    id: ${this.sanitizeId(layer.name)}`);
      lines.push(`    x: ${x}`);
      lines.push(`    y: ${y}`);
      lines.push(`    width: ${width}`);
      lines.push(`    height: ${height}`);
      lines.push(`    color: "${rectProps.color}"`);
      if (rectProps.radius > 0) {
        lines.push(`    radius: ${rectProps.radius}`);
      }
      if (rectProps.borderWidth > 0 && rectProps.borderColor !== "transparent") {
        lines.push(`    border.width: ${rectProps.borderWidth}`);
        lines.push(`    border.color: "${rectProps.borderColor}"`);
      }
      if (rectProps.opacity !== undefined) {
        lines.push(`    opacity: ${rectProps.opacity.toFixed(2)}`);
      }
      lines.push(`}`);
    } else {
      qmlType = "Item";
      lines.push(`Item {`);
      lines.push(`    id: ${this.sanitizeId(layer.name)}`);
      lines.push(`    x: ${x}`);
      lines.push(`    y: ${y}`);
      lines.push(`    width: ${width}`);
      lines.push(`    height: ${height}`);
      lines.push(`}`);
    }

    return {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      geometry: {
        absolute: {
          x: Math.round(layer.absoluteFrame.x),
          y: Math.round(layer.absoluteFrame.y),
          width: Math.round(layer.absoluteFrame.width),
          height: Math.round(layer.absoluteFrame.height),
        },
        relative: {
          x: Math.round(layer.relativeFrame.x),
          y: Math.round(layer.relativeFrame.y),
          width: Math.round(layer.relativeFrame.width),
          height: Math.round(layer.relativeFrame.height),
        },
      },
      qmlType,
      textProps,
      rectProps,
      imageProps,
      qmlSnippet: lines.join("\n"),
    };
  }

  /**
   * 将图层名清理为合法的 QML ID（驼峰或下划线，去除特殊符号与以数字开头）
   */
  public static sanitizeId(name: string): string {
    let clean = name.trim().replace(/[^a-zA-Z0-9_]/g, "_");
    if (!clean) clean = "element";
    if (/^[0-9]/.test(clean)) {
      clean = "item_" + clean;
    }
    // 首字母小写以符合 QML id 规范
    return clean.charAt(0).toLowerCase() + clean.slice(1);
  }
}
