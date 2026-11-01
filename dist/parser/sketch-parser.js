"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSketchParser = exports.SketchParser = void 0;
class SketchParser {
    /**
     * 将任意 RGBA（支持 0-1 浮点、0-255 整数或 rgba 字符串）转换为标准规范化颜色对象
     */
    static parseColor(rawColor) {
        if (!rawColor)
            return undefined;
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 1;
        if (typeof rawColor === "string") {
            const matchRgba = rawColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
            if (matchRgba) {
                r = Number(matchRgba[1]);
                g = Number(matchRgba[2]);
                b = Number(matchRgba[3]);
                a = matchRgba[4] !== undefined ? Number(matchRgba[4]) : 1;
            }
            else if (rawColor.startsWith("#")) {
                const hexStr = rawColor.replace("#", "");
                if (hexStr.length === 6) {
                    r = parseInt(hexStr.substring(0, 2), 16);
                    g = parseInt(hexStr.substring(2, 4), 16);
                    b = parseInt(hexStr.substring(4, 6), 16);
                }
                else if (hexStr.length === 8) {
                    r = parseInt(hexStr.substring(0, 2), 16);
                    g = parseInt(hexStr.substring(2, 4), 16);
                    b = parseInt(hexStr.substring(4, 6), 16);
                    a = parseInt(hexStr.substring(6, 8), 16) / 255;
                }
            }
        }
        else if (typeof rawColor === "object") {
            if (typeof rawColor.value === "string" && rawColor.value.startsWith("rgba")) {
                return this.parseColor(rawColor.value);
            }
            r = Number(rawColor.r ?? rawColor.red ?? 0);
            g = Number(rawColor.g ?? rawColor.green ?? 0);
            b = Number(rawColor.b ?? rawColor.blue ?? 0);
            a = Number(rawColor.a ?? rawColor.alpha ?? 1);
            // Sketch 颜色经常采用 0.0 - 1.0 的浮点表示
            if (r <= 1.0 && g <= 1.0 && b <= 1.0 && (r > 0 || g > 0 || b > 0)) {
                r = Math.round(r * 255);
                g = Math.round(g * 255);
                b = Math.round(b * 255);
            }
            else {
                r = Math.round(Math.min(255, Math.max(0, r)));
                g = Math.round(Math.min(255, Math.max(0, g)));
                b = Math.round(Math.min(255, Math.max(0, b)));
            }
        }
        a = Math.min(1.0, Math.max(0.0, a));
        const toHex2 = (n) => n.toString(16).padStart(2, "0").toUpperCase();
        const alphaHex = toHex2(Math.round(a * 255));
        const hex = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
        // QML 中 8 位 Hex 的格式通常是 #AARRGGBB
        const hexWithAlpha = `#${alphaHex}${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
        const rgbaCss = `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(2))})`;
        const qtRgba = `Qt.rgba(${(r / 255).toFixed(3)}, ${(g / 255).toFixed(3)}, ${(b / 255).toFixed(3)}, ${a.toFixed(2)})`;
        return {
            r,
            g,
            b,
            a,
            hex,
            hexWithAlpha,
            rgbaCss,
            qtRgba,
        };
    }
    /**
     * 解析蓝湖全量 Schema JSON（兼容原生 Sketch 嵌套树与蓝湖 DDS 扁平索引结构）
     */
    parse(schema, fallbackMeta) {
        const layerMap = new Map();
        const allSlices = [];
        // 检测是否为蓝湖 DDS 格式（schema.info 为包含多个图层的平铺数组）
        if (Array.isArray(schema.info) && schema.info.length > 1) {
            return this.parseDdsSchema(schema, fallbackMeta);
        }
        // 经典嵌套 Sketch 树解析
        let artboardNode = schema.artboard || schema;
        if (Array.isArray(schema.info) && schema.info.length > 0) {
            artboardNode = schema.info[0];
        }
        else if (Array.isArray(schema.layers) && schema.layers.length > 0 && !schema.artboard) {
            artboardNode = schema;
        }
        const rawAssets = Array.isArray(schema.assets) ? schema.assets : [];
        const assetByLayerId = new Map();
        for (const a of rawAssets) {
            const lid = a.layer_id || a.layerId || a.id;
            if (lid && a.url) {
                const item = {
                    id: a.id || lid,
                    layerId: lid,
                    name: a.name || "slice",
                    format: (a.format || "png").toLowerCase(),
                    scale: a.scale || "1x",
                    url: a.url,
                    width: a.width,
                    height: a.height,
                };
                const list = assetByLayerId.get(lid) || [];
                list.push(item);
                assetByLayerId.set(lid, list);
                allSlices.push(item);
            }
        }
        const artboardWidth = artboardNode.frame?.width || artboardNode.width || fallbackMeta?.width || 1920;
        const artboardHeight = artboardNode.frame?.height || artboardNode.height || fallbackMeta?.height || 1080;
        const artboardName = artboardNode.name || fallbackMeta?.name || "Artboard";
        const artboardId = artboardNode.id || artboardNode.do_objectID || "root_artboard";
        const topLayers = Array.isArray(artboardNode.layers)
            ? artboardNode.layers
            : Array.isArray(schema.layers)
                ? schema.layers
                : [];
        const rootLayers = [];
        for (const rawLayer of topLayers) {
            const parsed = this.traverseLayer(rawLayer, 0, 0, 0, undefined, layerMap, assetByLayerId, allSlices);
            if (parsed) {
                rootLayers.push(parsed);
            }
        }
        return {
            id: artboardId,
            name: artboardName,
            width: artboardWidth,
            height: artboardHeight,
            rootLayers,
            layerMap,
            slices: allSlices,
        };
    }
    /**
     * 专门解析蓝湖 DDS 格式结构
     */
    parseDdsSchema(schema, fallbackMeta) {
        const layerMap = new Map();
        const allSlices = [];
        const infoList = schema.info;
        // 找到画板根节点
        const artboardNode = infoList.find((i) => i.ddsType === "artboard-group" || !i.parentID) || infoList[0];
        const artboardId = String(artboardNode.id || "root_artboard");
        const artboardName = artboardNode.name || fallbackMeta?.name || "Artboard";
        const artboardWidth = Number(artboardNode.width || fallbackMeta?.width || 1920);
        const artboardHeight = Number(artboardNode.height || fallbackMeta?.height || 1080);
        // 建立父子关系索引: parentID -> childRawNodes[]
        const childrenMap = new Map();
        for (const item of infoList) {
            if (item.id === artboardId)
                continue;
            const pid = item.parentID || artboardId;
            if (!childrenMap.has(pid)) {
                childrenMap.set(pid, []);
            }
            childrenMap.get(pid).push(item);
        }
        // 递归构建 NormalizedLayer
        const parseNode = (raw, depth, parent) => {
            const id = String(raw.id || Math.random().toString(36).substring(2));
            const name = String(raw.name || "Layer");
            const rawClass = String(raw.type || raw.ddsType || "other").toLowerCase();
            const isVisible = raw.isVisible !== false;
            const isLocked = raw.isLocked === true;
            // 在 DDS 中，left/top 直接是相对于画板的绝对物理坐标
            const absX = Number(raw.left ?? raw.layerOriginFrame?.x ?? 0);
            const absY = Number(raw.top ?? raw.layerOriginFrame?.y ?? 0);
            const w = Number(raw.width ?? raw.layerOriginFrame?.width ?? 0);
            const h = Number(raw.height ?? raw.layerOriginFrame?.height ?? 0);
            const parentAbsX = parent ? Number(parent.left ?? 0) : 0;
            const parentAbsY = parent ? Number(parent.top ?? 0) : 0;
            const relativeFrame = {
                x: absX - parentAbsX,
                y: absY - parentAbsY,
                width: w,
                height: h,
            };
            const absoluteFrame = {
                x: absX,
                y: absY,
                width: w,
                height: h,
            };
            // 判定类型
            let type = "other";
            if (raw.type === "text" || raw.font) {
                type = "text";
            }
            else if (raw.type === "bitmap") {
                type = "image";
            }
            else if (raw.type === "shape" || raw.ddsType === "rectangle" || raw.ddsType === "oval") {
                type = "rectangle";
            }
            else if (raw.type === "layer-group" || raw.ddsType === "shape-group" || raw.ddsType === "artboard-group") {
                type = "group";
            }
            // 提取色彩、边框与圆角
            let backgroundColor;
            let borderColor;
            let borderWidth;
            let borderRadius;
            let opacity;
            const fills = raw.fills || raw.style?.fills;
            if (Array.isArray(fills)) {
                const activeFill = fills.find((f) => f.isEnabled !== false);
                if (activeFill?.color) {
                    backgroundColor = SketchParser.parseColor(activeFill.color);
                }
            }
            const borders = raw.borders || raw.style?.borders;
            if (Array.isArray(borders)) {
                const activeBorder = borders.find((b) => b.isEnabled !== false);
                if (activeBorder?.color) {
                    borderColor = SketchParser.parseColor(activeBorder.color);
                    borderWidth = Number(activeBorder.thickness || 1);
                }
            }
            if (raw.opacity !== undefined) {
                opacity = Number(raw.opacity) / 100;
            }
            if (raw.cornerRadius !== undefined) {
                borderRadius = Number(raw.cornerRadius);
            }
            else if (raw.fixedRadius !== undefined) {
                borderRadius = Number(raw.fixedRadius);
            }
            else if (Array.isArray(raw.points) && raw.points[0]?.cornerRadius) {
                borderRadius = Number(raw.points[0].cornerRadius);
            }
            // 文本排版信息解析
            let typography;
            if (type === "text") {
                const fontObj = raw.font || {};
                const textStr = fontObj.content || raw.text || name;
                const fontSize = Number(fontObj.size || 14);
                const fontFamily = fontObj.displayName || fontObj.font;
                const fontWeight = fontObj.styles?.[0]?.fontWeight;
                const lineHeight = Number(fontObj.line || fontObj.styles?.[0]?.line || fontSize);
                const textColor = SketchParser.parseColor(fontObj.color) || backgroundColor;
                typography = {
                    text: textStr,
                    fontSize,
                    fontFamily,
                    fontWeight,
                    lineHeight,
                    color: textColor,
                };
            }
            // 切图资产提取（蓝湖 DDS 的 image 对象和 exportable 属性）
            const exportAssets = [];
            if (raw.image && (raw.image.imageUrl || raw.image.svgUrl)) {
                if (raw.image.imageUrl) {
                    const pngSlice = {
                        id: `slice_png_${id}`,
                        layerId: id,
                        name: name,
                        format: "png",
                        scale: "1x",
                        url: raw.image.imageUrl,
                        width: raw.image.size?.width || w,
                        height: raw.image.size?.height || h,
                    };
                    exportAssets.push(pngSlice);
                    allSlices.push(pngSlice);
                }
                if (raw.image.svgUrl) {
                    const svgSlice = {
                        id: `slice_svg_${id}`,
                        layerId: id,
                        name: name,
                        format: "svg",
                        scale: "1x",
                        url: raw.image.svgUrl,
                        width: raw.image.size?.width || w,
                        height: raw.image.size?.height || h,
                    };
                    exportAssets.push(svgSlice);
                    allSlices.push(svgSlice);
                }
            }
            const isSlice = raw.exportable === true || exportAssets.length > 0;
            if (isSlice && type !== "text") {
                type = "slice";
            }
            const childrenIds = [];
            const normalized = {
                id,
                name,
                type,
                rawClass,
                isVisible,
                isLocked,
                relativeFrame,
                absoluteFrame,
                parentId: parent ? parent.id : undefined,
                childrenIds,
                depth,
                backgroundColor,
                borderColor,
                borderWidth,
                borderRadius,
                opacity,
                typography,
                isSlice,
                exportAssets,
                rawNode: raw,
            };
            layerMap.set(id, normalized);
            const rawChildren = childrenMap.get(id) || [];
            for (const childRaw of rawChildren) {
                const childNorm = parseNode(childRaw, depth + 1, raw);
                childrenIds.push(childNorm.id);
            }
            return normalized;
        };
        const rootChildren = childrenMap.get(artboardId) || [];
        const rootLayers = rootChildren.map((rc) => parseNode(rc, 1, artboardNode));
        return {
            id: artboardId,
            name: artboardName,
            width: artboardWidth,
            height: artboardHeight,
            rootLayers,
            layerMap,
            slices: allSlices,
        };
    }
    traverseLayer(raw, parentAbsX, parentAbsY, depth, parentId, layerMap, assetByLayerId, allSlices) {
        if (!raw || typeof raw !== "object")
            return null;
        const id = String(raw.id || raw.do_objectID || raw._id || Math.random().toString(36).substring(2));
        const name = String(raw.name || "Layer");
        const rawClass = String(raw._class || raw.type || "other").toLowerCase();
        const isVisible = raw.isVisible !== false && raw.visible !== false;
        const isLocked = raw.isLocked === true;
        // 坐标计算
        const rx = Number(raw.frame?.x ?? raw.left ?? 0);
        const ry = Number(raw.frame?.y ?? raw.top ?? 0);
        const rw = Number(raw.frame?.width ?? raw.width ?? 0);
        const rh = Number(raw.frame?.height ?? raw.height ?? 0);
        const relativeFrame = { x: rx, y: ry, width: rw, height: rh };
        const absoluteFrame = {
            x: parentAbsX + rx,
            y: parentAbsY + ry,
            width: rw,
            height: rh,
        };
        // 识别图层类型
        let type = "other";
        if (rawClass === "text") {
            type = "text";
        }
        else if (rawClass === "group" || rawClass === "artboard") {
            type = "group";
        }
        else if (rawClass === "slice") {
            type = "slice";
        }
        else if (rawClass === "bitmap") {
            type = "image";
        }
        else if (rawClass === "rectangle" ||
            rawClass === "oval" ||
            rawClass === "shapegroup" ||
            rawClass === "shapepath") {
            type = "rectangle";
        }
        // 样式解析（颜色、圆角、边框）
        let backgroundColor;
        let borderColor;
        let borderWidth;
        let borderRadius;
        let opacity;
        if (raw.style) {
            // 填充色
            if (Array.isArray(raw.style.fills)) {
                const activeFill = raw.style.fills.find((f) => f.isEnabled !== false);
                if (activeFill?.color) {
                    backgroundColor = SketchParser.parseColor(activeFill.color);
                }
            }
            // 边框色与粗细
            if (Array.isArray(raw.style.borders)) {
                const activeBorder = raw.style.borders.find((b) => b.isEnabled !== false);
                if (activeBorder?.color) {
                    borderColor = SketchParser.parseColor(activeBorder.color);
                    borderWidth = Number(activeBorder.thickness || 1);
                }
            }
            // 不透明度
            if (raw.style.contextSettings?.opacity !== undefined) {
                opacity = Number(raw.style.contextSettings.opacity);
            }
        }
        // 圆角
        if (raw.fixedRadius !== undefined) {
            borderRadius = Number(raw.fixedRadius);
        }
        else if (raw.cornerRadius !== undefined) {
            borderRadius = Number(raw.cornerRadius);
        }
        else if (Array.isArray(raw.points) && raw.points[0]?.cornerRadius) {
            borderRadius = Number(raw.points[0].cornerRadius);
        }
        // 文本排版信息解析
        let typography;
        if (type === "text") {
            let textStr = "";
            if (typeof raw.text === "string") {
                textStr = raw.text;
            }
            else if (typeof raw.attributedString?.string === "string") {
                textStr = raw.attributedString.string;
            }
            let fontSize = 14;
            let fontFamily;
            let fontWeight;
            let lineHeight;
            let textColor;
            const textAttr = raw.style?.textStyle?.encodedAttributes ||
                raw.attributedString?.attributes?.[0]?.attributes;
            if (textAttr) {
                if (textAttr.MSAttributedStringFontAttribute) {
                    const fontAttr = textAttr.MSAttributedStringFontAttribute;
                    fontSize = Number(fontAttr.attributes?.size || fontAttr.size || fontSize);
                    fontFamily = fontAttr.attributes?.name || fontAttr.name;
                }
                else if (textAttr.fontSize) {
                    fontSize = Number(textAttr.fontSize);
                    fontFamily = textAttr.fontFamily;
                }
                if (textAttr.MSAttributedStringColorAttribute) {
                    textColor = SketchParser.parseColor(textAttr.MSAttributedStringColorAttribute);
                }
                else if (textAttr.color) {
                    textColor = SketchParser.parseColor(textAttr.color);
                }
                if (textAttr.paragraphStyle?.maximumLineHeight) {
                    lineHeight = Number(textAttr.paragraphStyle.maximumLineHeight);
                }
            }
            typography = {
                text: textStr,
                fontSize,
                fontFamily,
                fontWeight,
                lineHeight,
                color: textColor || backgroundColor,
            };
        }
        // 切图资产提取
        const exportAssets = [];
        const directAssets = assetByLayerId.get(id) || [];
        exportAssets.push(...directAssets);
        // 若节点自身带有切片属性
        const hasExportFormats = Array.isArray(raw.exportOptions?.exportFormats) &&
            raw.exportOptions.exportFormats.length > 0;
        const sliceUrl = raw.slice_url || raw.image_url || raw.url;
        if (sliceUrl && exportAssets.length === 0) {
            const sliceItem = {
                id: `slice_${id}`,
                layerId: id,
                name: name,
                format: (raw.exportOptions?.exportFormats?.[0]?.format || "png").toLowerCase(),
                scale: "1x",
                url: sliceUrl,
                width: rw,
                height: rh,
            };
            exportAssets.push(sliceItem);
            allSlices.push(sliceItem);
        }
        const isSlice = type === "slice" || hasExportFormats || exportAssets.length > 0;
        if (isSlice && type !== "text") {
            type = "slice";
        }
        const childrenIds = [];
        const normalized = {
            id,
            name,
            type,
            rawClass,
            isVisible,
            isLocked,
            relativeFrame,
            absoluteFrame,
            parentId,
            childrenIds,
            depth,
            backgroundColor,
            borderColor,
            borderWidth,
            borderRadius,
            opacity,
            typography,
            isSlice,
            exportAssets,
            rawNode: raw,
        };
        layerMap.set(id, normalized);
        // 递归遍历子图层
        if (Array.isArray(raw.layers) && raw.layers.length > 0) {
            for (const childRaw of raw.layers) {
                const child = this.traverseLayer(childRaw, absoluteFrame.x, absoluteFrame.y, depth + 1, id, layerMap, assetByLayerId, allSlices);
                if (child) {
                    childrenIds.push(child.id);
                }
            }
        }
        return normalized;
    }
}
exports.SketchParser = SketchParser;
exports.defaultSketchParser = new SketchParser();
//# sourceMappingURL=sketch-parser.js.map