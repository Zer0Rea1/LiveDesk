import fs from 'fs';
import path from 'path';

let configCache: any = null;

export function getAppConfig() {
    if (!configCache) {
        try {
            const configPath = path.join(process.cwd(), 'config.json');
            if (fs.existsSync(configPath)) {
                configCache = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            } else {
                configCache = {};
            }
        } catch (e) {
            console.error('Error reading config.json', e);
            configCache = {};
        }
    }
    return {
        REPORTER_BASE_URL: configCache.REPORTER_BASE_URL || process.env.REPORTER_BASE_URL,
        SRT_SERVER_HOST: configCache.SRT_SERVER_HOST || process.env.SRT_SERVER_HOST,
        SRT_SERVER_PORT: configCache.SRT_SERVER_PORT || process.env.SRT_SERVER_PORT
    };
}
