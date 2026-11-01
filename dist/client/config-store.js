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
exports.defaultConfigStore = exports.ConfigStore = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const CONFIG_FILE_NAME = ".gemini-lanhu.config.json";
class ConfigStore {
    configPath;
    constructor(customPath) {
        this.configPath = customPath || path.join(os.homedir(), CONFIG_FILE_NAME);
    }
    getConfig() {
        let fileConfig = {};
        if (fs.existsSync(this.configPath)) {
            try {
                const raw = fs.readFileSync(this.configPath, "utf-8");
                fileConfig = JSON.parse(raw);
            }
            catch {
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
    getCookie() {
        return this.getConfig().cookie;
    }
    saveConfig(updates) {
        let current = {};
        if (fs.existsSync(this.configPath)) {
            try {
                current = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
            }
            catch {
                current = {};
            }
        }
        const merged = { ...current, ...updates };
        fs.writeFileSync(this.configPath, JSON.stringify(merged, null, 2), "utf-8");
    }
    setCookie(cookie) {
        this.saveConfig({ cookie });
    }
    getConfigPath() {
        return this.configPath;
    }
}
exports.ConfigStore = ConfigStore;
exports.defaultConfigStore = new ConfigStore();
//# sourceMappingURL=config-store.js.map