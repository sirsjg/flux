import { resolve, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
// Expand $ENV_VAR references in string values
function expandEnv(value) {
    if (!value?.startsWith('$'))
        return value;
    return process.env[value.slice(1)] || undefined;
}
// Find .flux directory (walk up from cwd, or use FLUX_DIR env)
export function findFluxDir() {
    if (process.env.FLUX_DIR) {
        return process.env.FLUX_DIR;
    }
    let dir = process.cwd();
    while (dirname(dir) !== dir) {
        const fluxDir = resolve(dir, '.flux');
        if (existsSync(fluxDir)) {
            return fluxDir;
        }
        dir = dirname(dir);
    }
    // Fall back to ~/.flux
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return resolve(homeDir, '.flux');
}
// Load .env.local from repo root (same dir as .flux parent)
export function loadEnvLocal(fluxDir) {
    const repoRoot = dirname(fluxDir);
    const envPath = resolve(repoRoot, '.env.local');
    if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
            if (match && !process.env[match[1]]) {
                let value = match[2];
                // Strip inline comments (not inside quotes)
                if (!value.startsWith('"') && !value.startsWith("'")) {
                    value = value.split('#')[0];
                }
                // Strip surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                process.env[match[1]] = value.trim();
            }
        }
    }
}
// Read raw config (unexpanded, for writing back)
export function readConfigRaw(fluxDir) {
    const configPath = resolve(fluxDir, 'config.json');
    if (existsSync(configPath)) {
        try {
            return JSON.parse(readFileSync(configPath, 'utf-8'));
        }
        catch {
            return {};
        }
    }
    return {};
}
// Read config from .flux/config.json (expands $ENV_VAR references)
export function readConfig(fluxDir) {
    const raw = readConfigRaw(fluxDir);
    return {
        ...raw,
        server: expandEnv(raw.server),
        apiKey: expandEnv(raw.apiKey),
    };
}
// Write config to .flux/config.json
export function writeConfig(fluxDir, config) {
    const configPath = resolve(fluxDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    // Set file permissions to 0600 (owner read/write only) since config may contain API keys
    try {
        chmodSync(configPath, 0o600);
    }
    catch {
        // Ignore chmod errors on Windows
    }
}
// Resolve the data file path from config (respects FLUX_DATA env, config.dataFile, defaults)
export function resolveDataPath(fluxDir, config) {
    if (process.env.FLUX_DATA) {
        return process.env.FLUX_DATA;
    }
    if (config.dataFile) {
        return resolve(fluxDir, config.dataFile);
    }
    return resolve(fluxDir, 'data.json');
}
