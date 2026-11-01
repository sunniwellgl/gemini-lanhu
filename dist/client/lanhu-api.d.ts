import { ConfigStore } from "./config-store.js";
export interface ParsedLanhuParams {
    projectId: string;
    imageId: string;
    teamId?: string;
    versionId?: string;
}
export interface LanhuImageMeta {
    id: string;
    name: string;
    projectId: string;
    width: number;
    height: number;
    previewUrl?: string;
    jsonUrl?: string;
    versionId?: string;
    updatedAt?: string;
}
export interface LanhuApiResponse<T> {
    status: number;
    message?: string;
    result?: T;
    data?: T;
}
export declare class LanhuApiClient {
    private configStore;
    private cacheDir;
    constructor(configStore?: ConfigStore, cacheDir?: string);
    private ensureCacheDir;
    /**
     * 解析蓝湖 Web URL 中的关键定位参数
     */
    parseUrl(rawUrl: string): ParsedLanhuParams;
    /**
     * 获取设计图元数据
     */
    getImageMeta(projectId: string, imageId: string): Promise<LanhuImageMeta>;
    /**
     * 拉取设计图的完整图层树 Schema（支持本地文件缓存）
     */
    getSchema(projectId: string, imageId: string, forceRefresh?: boolean): Promise<{
        meta: LanhuImageMeta;
        schema: any;
    }>;
    /**
     * 针对 DDS 格式画板，通过 version_id 查询 Schema 地址
     */
    private fetchDdsSchemaUrl;
}
export declare const defaultLanhuApiClient: LanhuApiClient;
//# sourceMappingURL=lanhu-api.d.ts.map