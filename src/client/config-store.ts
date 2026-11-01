import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface LanhuConfig {
  cookie?: string;
  baseUrl?: string;
}

const CONFIG_FILE_NAME = ".gemini-lanhu.config.json";

export class ConfigStore {
  private configPath: string;

  constructor(customPath?: string) {
    this.configPath = customPath || path.join(os.homedir(), CONFIG_FILE_NAME);
  }

  public getConfig(): LanhuConfig {
    let fileConfig: LanhuConfig = {};
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        fileConfig = JSON.parse(raw);
      } catch {
        fileConfig = {};
      }
    }

    const envCookie = process.env.LANHU_COOKIE;
    const envBaseUrl = process.env.LANHU_BASE_URL;

    return {
      baseUrl: envBaseUrl || fileConfig.baseUrl || "https://lanhuapp.com",
      cookie: envCookie || fileConfig.cookie,
    };
  }

  public getCookie(): string | undefined {
    return this.getConfig().cookie;
  }

  public saveConfig(updates: Partial<LanhuConfig>): void {
    let current: LanhuConfig = {};
    if (fs.existsSync(this.configPath)) {
      try {
        current = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
      } catch {
        current = {};
      }
    }

    const merged = { ...current, ...updates };
    fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2), "utf-8");
  }

  public setCookie(cookie: string): void {
    this.saveConfig({ cookie });
  }

  public getConfigPath(): string {
    return this.configPath;
  }
}

export const defaultConfigStore = new ConfigStore();
