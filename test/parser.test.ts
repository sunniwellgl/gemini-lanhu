import { describe, it, expect } from "vitest";
import { SketchParser } from "../src/parser/sketch-parser.js";
import { QmlAdapter } from "../src/parser/qml-adapter.js";

describe("SketchParser & QmlAdapter", () => {
  it("应正确解析 0-1 浮点色彩与 0-255 整数色彩", () => {
    // 浮点表示：半透明蓝色
    const floatColor = SketchParser.parseColor({ r: 0.2, g: 0.4, b: 0.8, a: 0.5 });
    expect(floatColor).toBeDefined();
    expect(floatColor?.r).toBe(Math.round(0.2 * 255));
    expect(floatColor?.hex.length).toBe(7); // #RRGGBB
    expect(floatColor?.hexWithAlpha.length).toBe(9); // #AARRGGBB

    // 整数表示：纯白
    const intColor = SketchParser.parseColor({ r: 255, g: 255, b: 255, a: 1 });
    expect(intColor?.hex).toBe("#FFFFFF");
    expect(intColor?.hexWithAlpha).toBe("#FFFFFFFF");
  });

  it("应准确执行 DFS 绝对坐标累加", () => {
    const mockSchema = {
      artboard: {
        id: "artboard_1",
        name: "测试画板",
        frame: { x: 0, y: 0, width: 1920, height: 1080 },
        layers: [
          {
            id: "group_1",
            name: "导航栏容器",
            _class: "group",
            frame: { x: 50, y: 100, width: 800, height: 200 },
            layers: [
              {
                id: "btn_1",
                name: "确定按钮",
                _class: "rectangle",
                frame: { x: 20, y: 30, width: 120, height: 40 },
                fixedRadius: 8,
                style: {
                  fills: [
                    {
                      isEnabled: true,
                      color: { r: 1, g: 0, b: 0, a: 1 },
                    },
                  ],
                  borders: [
                    {
                      isEnabled: true,
                      thickness: 2,
                      color: { r: 0, g: 0, b: 0, a: 1 },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    };

    const parser = new SketchParser();
    const result = parser.parse(mockSchema);

    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);

    const group = result.layerMap.get("group_1");
    expect(group?.absoluteFrame.x).toBe(50);
    expect(group?.absoluteFrame.y).toBe(100);

    const btn = result.layerMap.get("btn_1");
    expect(btn?.relativeFrame.x).toBe(20);
    expect(btn?.relativeFrame.y).toBe(30);
    // 绝对坐标应当累加父级的 50 和 100: 50 + 20 = 70, 100 + 30 = 130
    expect(btn?.absoluteFrame.x).toBe(70);
    expect(btn?.absoluteFrame.y).toBe(130);
    expect(btn?.borderRadius).toBe(8);
    expect(btn?.borderWidth).toBe(2);
    expect(btn?.backgroundColor?.hex).toBe("#FF0000");

    // 测试适配器转换
    if (btn) {
      const adapted = QmlAdapter.adapt(btn, { useAbsoluteCoords: true });
      expect(adapted.qmlType).toBe("Rectangle");
      expect(adapted.geometry.absolute.x).toBe(70);
      expect(adapted.geometry.absolute.y).toBe(130);
      expect(adapted.rectProps?.radius).toBe(8);
      expect(adapted.rectProps?.borderWidth).toBe(2);
      expect(adapted.qmlSnippet).toContain("Rectangle {");
      expect(adapted.qmlSnippet).toContain('color: "#FF0000"');
      expect(adapted.qmlSnippet).toContain("radius: 8");
    }
  });

  it("应正确解析文本图层并输出 QML Text 代码片段", () => {
    const mockSchema = {
      artboard: {
        id: "artboard_text",
        name: "文本测试",
        frame: { x: 0, y: 0, width: 375, height: 812 },
        layers: [
          {
            id: "title_layer",
            name: "标题文本",
            _class: "text",
            frame: { x: 16, y: 44, width: 200, height: 28 },
            text: "首页标题",
            style: {
              textStyle: {
                encodedAttributes: {
                  fontSize: 20,
                  fontFamily: "PingFang SC",
                  color: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
                },
              },
            },
          },
        ],
      },
    };

    const parser = new SketchParser();
    const result = parser.parse(mockSchema);
    const textLayer = result.layerMap.get("title_layer");

    expect(textLayer).toBeDefined();
    expect(textLayer?.type).toBe("text");
    expect(textLayer?.typography?.text).toBe("首页标题");
    expect(textLayer?.typography?.fontSize).toBe(20);

    if (textLayer) {
      const adapted = QmlAdapter.adapt(textLayer);
      expect(adapted.qmlType).toBe("Text");
      expect(adapted.textProps?.text).toBe("首页标题");
      expect(adapted.textProps?.pixelSize).toBe(20);
      expect(adapted.qmlSnippet).toContain("Text {");
      expect(adapted.qmlSnippet).toContain('text: qsTr("首页标题")');
      expect(adapted.qmlSnippet).toContain("font.pixelSize: 20");
    }
  });

  it("应正确解析切片切图并输出 QML Image 代码片段", () => {
    const mockSchema = {
      artboard: {
        id: "artboard_slice",
        name: "切图测试",
        frame: { x: 0, y: 0, width: 375, height: 812 },
        layers: [
          {
            id: "slice_layer",
            name: "icon_back",
            _class: "slice",
            frame: { x: 12, y: 20, width: 24, height: 24 },
            slice_url: "https://oss.lanhuapp.com/assets/icon_back.png",
            exportOptions: {
              exportFormats: [{ format: "png", scale: 1 }],
            },
          },
        ],
      },
    };

    const parser = new SketchParser();
    const result = parser.parse(mockSchema);
    expect(result.slices.length).toBe(1);
    expect(result.slices[0].name).toBe("icon_back");
    expect(result.slices[0].url).toBe("https://oss.lanhuapp.com/assets/icon_back.png");

    const sliceLayer = result.layerMap.get("slice_layer");
    expect(sliceLayer?.isSlice).toBe(true);

    if (sliceLayer) {
      const adapted = QmlAdapter.adapt(sliceLayer, { assetsFolder: "qrc:/assets/images" });
      expect(adapted.qmlType).toBe("Image");
      expect(adapted.imageProps?.source).toBe("qrc:/assets/images/icon_back.png");
      expect(adapted.qmlSnippet).toContain("Image {");
      expect(adapted.qmlSnippet).toContain('source: "qrc:/assets/images/icon_back.png"');
    }
  });
});
