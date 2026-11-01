"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLanhuMcpServer = createLanhuMcpServer;
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const zod_1 = require("zod");
const config_store_js_1 = require("../client/config-store.js");
const lanhu_api_js_1 = require("../client/lanhu-api.js");
const sketch_parser_js_1 = require("../parser/sketch-parser.js");
const qml_adapter_js_1 = require("../parser/qml-adapter.js");
const slice_service_js_1 = require("../services/slice-service.js");
function createLanhuMcpServer(options = {}) {
    const configStore = options.configStore || config_store_js_1.defaultConfigStore;
    const apiClient = options.apiClient || lanhu_api_js_1.defaultLanhuApiClient;
    const parser = options.parser || sketch_parser_js_1.defaultSketchParser;
    const server = new mcp_js_1.McpServer({
        name: "gemini-lanhu",
        version: "1.0.0",
    });
    // 内存中缓存最近一次解析的画板，提升多步操作的响应速度
    let lastArtboardCache = null;
    async function resolveArtboard(params) {
        let pid = params.projectId;
        let imgId = params.imageId;
        if (params.url) {
            const parsed = apiClient.parseUrl(params.url);
            pid = pid || parsed.projectId;
            imgId = imgId || parsed.imageId;
        }
        if (!pid || !imgId) {
            throw new Error("请提供有效的蓝湖链接 (url) 或同时提供 projectId 与 imageId。");
        }
        const cacheKey = `${pid}_${imgId}`;
        if (!params.forceRefresh && lastArtboardCache && lastArtboardCache.key === cacheKey) {
            return lastArtboardCache.artboard;
        }
        const { meta, schema } = await apiClient.getSchema(pid, imgId, params.forceRefresh);
        const artboard = parser.parse(schema, {
            width: meta.width,
            height: meta.height,
            name: meta.name,
        });
        lastArtboardCache = { key: cacheKey, artboard };
        return artboard;
    }
    // 1. 设置 Cookie
    server.tool("lanhu_set_cookie", "设置或更新蓝湖账号的登录 Cookie。配置将持久化保存在本地 ~/.gemini-lanhu.config.json 中。", {
        cookie: zod_1.z.string().describe("从浏览器开发者工具 (F12) 的网络请求头中复制的完整 Cookie 字符串"),
    }, async ({ cookie }) => {
        configStore.setCookie(cookie.trim());
        return {
            content: [
                {
                    type: "text",
                    text: `已成功配置蓝湖 Cookie 并保存至配置文件: ${configStore.getConfigPath()}`,
                },
            ],
        };
    });
    // 2. 查看当前配置状态
    server.tool("lanhu_get_config", "查看当前蓝湖凭据与配置状态（脱敏显示 Cookie，查看配置文件路径）。", {}, async () => {
        const config = configStore.getConfig();
        const hasCookie = Boolean(config.cookie);
        const maskedCookie = config.cookie
            ? `${config.cookie.substring(0, 10)}...${config.cookie.substring(config.cookie.length - 10)}`
            : "未配置";
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        configured: hasCookie,
                        configPath: configStore.getConfigPath(),
                        baseUrl: config.baseUrl,
                        cookieStatus: maskedCookie,
                    }, null, 2),
                },
            ],
        };
    });
    // 3. 解析蓝湖设计稿 URL
    server.tool("lanhu_parse_url", "解析蓝湖画板或设计图 Web 链接，提取底层 project_id、image_id、team_id 等核心定位参数。", {
        url: zod_1.z.string().describe("蓝湖设计图页面完整 URL"),
    }, async ({ url }) => {
        const parsed = apiClient.parseUrl(url);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(parsed, null, 2),
                },
            ],
        };
    });
    // 4. 获取画板基础信息
    server.tool("lanhu_get_image_info", "获取指定蓝湖设计稿的基本信息（画板名称、物理宽高尺寸、图层总数、可导出切图数）。", {
        url: zod_1.z.string().optional().describe("蓝湖设计图完整 URL"),
        projectId: zod_1.z.string().optional().describe("蓝湖项目 ID (pid)"),
        imageId: zod_1.z.string().optional().describe("设计稿画板 ID (image_id/docId)"),
        forceRefresh: zod_1.z.boolean().optional().describe("是否跳过本地缓存强制拉取最新设计稿，默认 false"),
    }, async (params) => {
        const artboard = await resolveArtboard(params);
        const sliceCount = slice_service_js_1.SliceService.extractSlices(artboard).length;
        const summary = {
            id: artboard.id,
            name: artboard.name,
            width: artboard.width,
            height: artboard.height,
            totalLayers: artboard.layerMap.size,
            rootLayersCount: artboard.rootLayers.length,
            exportableSlicesCount: sliceCount,
        };
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(summary, null, 2),
                },
            ],
        };
    });
    // 5. 列出图层大纲树
    server.tool("lanhu_list_layers", "列出设计稿中的图层树形骨架结构。支持指定最大展开深度以防文本过长，快速获取页面结构布局。", {
        url: zod_1.z.string().optional().describe("蓝湖设计图完整 URL"),
        projectId: zod_1.z.string().optional().describe("蓝湖项目 ID"),
        imageId: zod_1.z.string().optional().describe("设计稿画板 ID"),
        maxDepth: zod_1.z.number().optional().default(3).describe("树形层级展开最大深度，默认 3"),
        parentLayerId: zod_1.z.string().optional().describe("仅展开指定父图层的子节点，若不填则从根开始"),
    }, async (params) => {
        const artboard = await resolveArtboard(params);
        function formatLayerOutline(layerId, currentDepth) {
            const layer = artboard.layerMap.get(layerId);
            if (!layer)
                return null;
            const baseInfo = {
                id: layer.id,
                name: layer.name,
                type: layer.type,
                absRect: {
                    x: Math.round(layer.absoluteFrame.x),
                    y: Math.round(layer.absoluteFrame.y),
                    w: Math.round(layer.absoluteFrame.width),
                    h: Math.round(layer.absoluteFrame.height),
                },
                isSlice: layer.isSlice,
            };
            if (layer.typography) {
                baseInfo.text = layer.typography.text;
            }
            if (currentDepth < (params.maxDepth || 3) && layer.childrenIds.length > 0) {
                baseInfo.children = layer.childrenIds
                    .map((cid) => formatLayerOutline(cid, currentDepth + 1))
                    .filter(Boolean);
            }
            else if (layer.childrenIds.length > 0) {
                baseInfo.childrenCount = layer.childrenIds.length;
            }
            return baseInfo;
        }
        let tree;
        if (params.parentLayerId) {
            const parent = artboard.layerMap.get(params.parentLayerId);
            if (!parent) {
                throw new Error(`未找到 ID 为 "${params.parentLayerId}" 的图层。`);
            }
            tree = parent.childrenIds.map((cid) => formatLayerOutline(cid, 1)).filter(Boolean);
        }
        else {
            tree = artboard.rootLayers.map((rl) => formatLayerOutline(rl.id, 1)).filter(Boolean);
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(tree, null, 2),
                },
            ],
        };
    });
    // 6. 搜索图层
    server.tool("lanhu_search_layers", "按名称或文字内容在画板中检索匹配的图层，快速定位目标按钮、输入框、标题或图标。", {
        query: zod_1.z.string().describe("搜索关键词（匹配图层名称或包含的文本内容）"),
        url: zod_1.z.string().optional().describe("蓝湖设计图完整 URL"),
        projectId: zod_1.z.string().optional().describe("蓝湖项目 ID"),
        imageId: zod_1.z.string().optional().describe("设计稿画板 ID"),
        type: zod_1.z
            .enum(["all", "text", "rectangle", "slice", "group", "image"])
            .optional()
            .default("all")
            .describe("按图层类型过滤，默认为 all"),
    }, async ({ query, url, projectId, imageId, type }) => {
        const artboard = await resolveArtboard({ url, projectId, imageId });
        const q = query.toLowerCase().trim();
        const matched = [];
        for (const layer of artboard.layerMap.values()) {
            if (type && type !== "all" && layer.type !== type) {
                continue;
            }
            const matchName = layer.name.toLowerCase().includes(q);
            const matchText = layer.typography?.text.toLowerCase().includes(q);
            if (matchName || matchText) {
                matched.push({
                    id: layer.id,
                    name: layer.name,
                    type: layer.type,
                    text: layer.typography?.text,
                    isSlice: layer.isSlice,
                    absRect: {
                        x: Math.round(layer.absoluteFrame.x),
                        y: Math.round(layer.absoluteFrame.y),
                        w: Math.round(layer.absoluteFrame.width),
                        h: Math.round(layer.absoluteFrame.height),
                    },
                });
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        query,
                        matchCount: matched.length,
                        results: matched,
                    }, null, 2),
                },
            ],
        };
    });
    // 7. 获取图层详细属性（QML 专用）
    server.tool("lanhu_get_element_properties", "提取指定图层的坐标、尺寸、色彩、边框、圆角、字体排版属性，直接输出专为 QML 设计的属性对象及参考 QML 组件代码草稿。", {
        layerId: zod_1.z.string().describe("图层唯一标识 ID"),
        url: zod_1.z.string().optional().describe("蓝湖设计图完整 URL"),
        projectId: zod_1.z.string().optional().describe("蓝湖项目 ID"),
        imageId: zod_1.z.string().optional().describe("设计稿画板 ID"),
        useAbsoluteCoords: zod_1.z.boolean().optional().default(true).describe("是否使用画板绝对坐标，默认 true"),
        assetsFolder: zod_1.z
            .string()
            .optional()
            .default("images")
            .describe("图片资源相对路径或 QRC 前缀（如 'images' 或 'qrc:/assets/images'）"),
    }, async ({ layerId, url, projectId, imageId, useAbsoluteCoords, assetsFolder }) => {
        const artboard = await resolveArtboard({ url, projectId, imageId });
        const layer = artboard.layerMap.get(layerId);
        if (!layer) {
            throw new Error(`未找到 ID 为 "${layerId}" 的图层。可先使用 lanhu_search_layers 搜索图层 ID。`);
        }
        const qmlDetails = qml_adapter_js_1.QmlAdapter.adapt(layer, {
            useAbsoluteCoords,
            assetsFolder,
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(qmlDetails, null, 2),
                },
            ],
        };
    });
    // 8. 列出可导出切图
    server.tool("lanhu_list_slices", "获取设计稿中所有可导出的切图/图标列表（包含切图名、格式、缩放规格、对应图层与尺寸）。", {
        url: zod_1.z.string().optional().describe("蓝湖设计图完整 URL"),
        projectId: zod_1.z.string().optional().describe("蓝湖项目 ID"),
        imageId: zod_1.z.string().optional().describe("设计稿画板 ID"),
    }, async (params) => {
        const artboard = await resolveArtboard(params);
        const slices = slice_service_js_1.SliceService.extractSlices(artboard);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        totalSlices: slices.length,
                        slices: slices.map((s) => ({
                            id: s.id,
                            name: s.name,
                            format: s.format,
                            scale: s.scale,
                            layerId: s.layerId,
                            layerName: s.layerName,
                            size: s.width && s.height ? `${s.width}x${s.height}` : undefined,
                            url: s.url,
                        })),
                    }, null, 2),
                },
            ],
        };
    });
    // 9. 下载切图至本地目录
    server.tool("lanhu_download_slices", "批量或指定名称下载设计稿中的切图资产到本地工程目录（例如当前 QML 项目的 assets/images），返回落地后的文件相对路径供 QML 直接引用。", {
        outputDir: zod_1.z.string().describe("本地保存切图的目录路径（相对当前工作区或绝对路径，如 './images'）"),
        url: zod_1.z.string().optional().describe("蓝湖设计图完整 URL"),
        projectId: zod_1.z.string().optional().describe("蓝湖项目 ID"),
        imageId: zod_1.z.string().optional().describe("设计稿画板 ID"),
        filterNames: zod_1.z
            .array(zod_1.z.string())
            .optional()
            .describe("可选：仅下载指定名称的切图列表（若不提供则下载全部）"),
        platform: zod_1.z
            .enum(["web", "ios", "android"])
            .optional()
            .default("web")
            .describe("切图导出平台：web（默认，name.png、name@2x.png）、ios（name.png、name@2x.png、name@3x.png）或 android（按 mipmap-* 目录归类）"),
        formats: zod_1.z
            .array(zod_1.z.string())
            .optional()
            .default(["png"])
            .describe("导出的图片格式列表，如 ['png']、['svg']，默认 ['png']"),
        overwrite: zod_1.z.boolean().optional().default(true).describe("若本地文件已存在是否覆盖，默认 true"),
    }, async ({ outputDir, url, projectId, imageId, filterNames, platform, formats, overwrite }) => {
        const artboard = await resolveArtboard({ url, projectId, imageId });
        const slices = slice_service_js_1.SliceService.extractSlices(artboard);
        if (slices.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "当前设计稿中未检测到任何可导出的切图/切片资源。",
                    },
                ],
            };
        }
        const results = await slice_service_js_1.SliceService.downloadSlices({
            slices,
            outputDir,
            filterNames,
            platform,
            formats,
            overwrite,
        });
        const successCount = results.filter((r) => r.success).length;
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        totalAttempted: results.length,
                        successCount,
                        outputDir,
                        files: results,
                    }, null, 2),
                },
            ],
        };
    });
    return server;
}
//# sourceMappingURL=mcp-server.js.map