export interface LanhuConfig {
    cookie?: string;
    baseUrl?: string;
}
export declare class ConfigStore {
    private configPath;
    constructor(customPath?: string);
    getConfig(): LanhuConfig;
    getCookie(): string | undefined;
    saveConfig(updates: Partial<LanhuConfig>): void;
    setCookie(cookie: string): void;
    getConfigPath(): string;
}
export declare const defaultConfigStore: ConfigStore;
//# sourceMappingURL=config-store.d.ts.map