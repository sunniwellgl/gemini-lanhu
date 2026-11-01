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
exports.defaultLanhuApiClient = exports.LanhuApiClient = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const config_store_js_1 = require("./config-store.js");
class LanhuApiClient {
    configStore;
    cacheDir;
    constructor(configStore = config_store_js_1.defaultConfigStore, cacheDir) {
        this.configStore = configStore;
        this.cacheDir = cacheDir || path.join(os.homedir(), ".cache", "gemini-lanhu");
        this.ensureCacheDir();
    }
    ensureCacheDir() {
        try {
            if (!fs.existsSync(this.cacheDir)) {
                fs.mkdirSync(this.cacheDir, { recursive: true });
            }
        }
        catch {
            // 忽略无法创建缓存目录的边缘异常
        }
    }
    /**
     * 解析蓝湖 Web URL 中的关键定位参数
     */
    parseUrl(rawUrl) {
        let urlString = rawUrl.trim();
        if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
            urlString = "https://" + urlString;
        }
        const url = new URL(urlString);
        let searchParams = url.searchParams;
        // 蓝湖 Web 端 URL 常常将路由和查询参数置于 hash 之后: #/item/project/board/detail?pid=...
        if (url.hash && url.hash.includes("?")) {
            const hashQuery = url.hash.substring(url.hash.indexOf("?") + 1);
            const hashParams = new URLSearchParams(hashQuery);
            // 合并 hash 中的参数，hash 优先级更高
            hashParams.forEach((val, key) => {
                searchParams.set(key, val);
            });
        }
        const projectId = searchParams.get("pid") ||
            searchParams.get("project_id") ||
            searchParams.get("projectId") ||
            "";
        const imageId = searchParams.get("image_id") ||
            searchParams.get("imageId") ||
            searchParams.get("docId") ||
            searchParams.get("id") ||
            "";
        const teamId = searchParams.get("tid") ||
            searchParams.get("team_id") ||
            searchParams.get("teamId") ||
            undefined;
        const versionId = searchParams.get("version_id") ||
            searchParams.get("versionId") ||
            undefined;
        if (!projectId || !imageId) {
            throw new Error(`无法从 URL 中解析出有效的 projectId 和 imageId。传入的 URL 为: "${rawUrl}"。请确保链接中包含 pid(project_id) 与 image_id(docId)。`);
        }
        return {
            projectId,
            imageId,
            teamId,
            versionId,
        };
    }
    /**
     * 获取设计图元数据
     */
    async getImageMeta(projectId, imageId) {
        const config = this.configStore.getConfig();
        const cookie = config.cookie;
        if (!cookie) {
            throw new Error("未配置蓝湖 Cookie。请先使用工具 `lanhu_set_cookie` 设置登录 Cookie，或在环境变量中配置 LANHU_COOKIE。");
        }
        const baseUrl = config.baseUrl || "https://lanhuapp.com";
        const endpoint = `${baseUrl}/api/project/image?project_id=${encodeURIComponent(projectId)}&image_id=${encodeURIComponent(imageId)}&dds_status=1`;
        const headers = {
            Cookie: cookie,
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Referer: `${baseUrl}/web/`,
            Accept: "application/json, text/plain, */*",
        };
        const res = await fetch(endpoint, {
            method: "GET",
            headers,
        });
        if (!res.ok) {
            throw new Error(`请求蓝湖接口失败: HTTP ${res.status} ${res.statusText} (${endpoint})`);
        }
        const data = (await res.json());
        if (data.status !== 0 && data.status !== 200 && data.status !== undefined) {
            // 蓝湖接口 0 代表成功
            const msg = data.message || JSON.stringify(data);
            throw new Error(`蓝湖接口业务报错 (status=${data.status}): ${msg}`);
        }
        const result = data.result || data.data || data;
        // 解析 JSON Schema 的 URL
        let jsonUrl = result.json_url;
        let versionId = result.version_id;
        if (Array.isArray(result.versions) && result.versions.length > 0) {
            const latestVersion = result.versions[0];
            versionId = latestVersion.version_id || versionId;
            jsonUrl =
                latestVersion.json_url ||
                    latestVersion.dds_json_url ||
                    latestVersion.url ||
                    jsonUrl;
        }
        return {
            id: result.id || imageId,
            name: result.name || "未命名画板",
            projectId: result.project_id || projectId,
            width: Number(result.width || 0),
            height: Number(result.height || 0),
            previewUrl: result.url || result.image_url,
            jsonUrl,
            versionId,
            updatedAt: result.updated_at || result.update_time,
        };
    }
    /**
     * 拉取设计图的完整图层树 Schema（支持本地文件缓存）
     */
    async getSchema(projectId, imageId, forceRefresh = false) {
        const meta = await this.getImageMeta(projectId, imageId);
        const cacheKey = `${projectId}_${imageId}_${meta.versionId || "latest"}.json`;
        const cacheFile = path.join(this.cacheDir, cacheKey);
        if (!forceRefresh && fs.existsSync(cacheFile)) {
            try {
                const cachedRaw = fs.readFileSync(cacheFile, "utf-8");
                const cachedSchema = JSON.parse(cachedRaw);
                return { meta, schema: cachedSchema };
            }
            catch {
                // 缓存损坏则继续拉取网络
            }
        }
        let targetSchemaUrl = meta.jsonUrl;
        // 若 versions 中未直接带 jsonUrl，尝试查询 dds store_schema_revise
        if (!targetSchemaUrl && meta.versionId) {
            targetSchemaUrl = await this.fetchDdsSchemaUrl(meta.versionId);
        }
        if (!targetSchemaUrl) {
            throw new Error(`未能获取到设计图 "${meta.name}" (${meta.id}) 的图层 Schema URL。请检查该设计稿是否已在蓝湖生成标注。`);
        }
        const schemaRes = await fetch(targetSchemaUrl, {
            method: "GET",
        });
        if (!schemaRes.ok) {
            throw new Error(`下载设计图 Schema JSON 失败: HTTP ${schemaRes.status} ${schemaRes.statusText}`);
        }
        const schema = await schemaRes.json();
        // 写入本地缓存以优化后续相同设计图查询速度
        try {
            fs.writeFileSync(cacheFile, JSON.stringify(schema), "utf-8");
        }
        catch {
            // 忽略缓存写盘异常
        }
        return { meta, schema };
    }
    /**
     * 针对 DDS 格式画板，通过 version_id 查询 Schema 地址
     */
    async fetchDdsSchemaUrl(versionId) {
        const config = this.configStore.getConfig();
        const baseUrl = config.baseUrl || "https://lanhuapp.com";
        const endpoint = `${baseUrl}/api/dds/image/store_schema_revise?version_id=${encodeURIComponent(versionId)}`;
        const res = await fetch(endpoint, {
            headers: {
                Cookie: config.cookie || "",
                "User-Agent": "Mozilla/5.0",
                Referer: `${baseUrl}/web/`,
            },
        });
        if (!res.ok)
            return undefined;
        const data = (await res.json());
        const resObj = data.result || data.data;
        return resObj?.data_resource_url || resObj?.url;
    }
}
exports.LanhuApiClient = LanhuApiClient;
exports.defaultLanhuApiClient = new LanhuApiClient();
//# sourceMappingURL=lanhu-api.js.map