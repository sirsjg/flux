import { resolve, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Load .env.local from repo root (same dir as .flux parent)
export function loadEnvLocal(fluxDir: string): void {
  const repoRoot = dirname(fluxDir);
  const envPath = resolve(repoRoot, '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

export type FluxConfig = {
  server?: string;    // Server URL (server mode)
  apiKey?: string;    // API key for server auth (supports $ENV_VAR)
  dataFile?: string;  // Local data file path (file mode)
  project?: string;   // Default project ID
};

// Expand $ENV_VAR references in string values
function expandEnv(value: string | undefined): string | undefined {
  if (!value?.startsWith('$')) return value;
  return process.env[value.slice(1)] || undefined;
}

// Find .flux directory (walk up from cwd, or use FLUX_DIR env)
export function findFluxDir(): string {
  if (process.env.FLUX_DIR) {
    return process.env.FLUX_DIR;
  }

  let dir = process.cwd();
  while (dir !== '/') {
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

// Read raw config (unexpanded, for writing back)
export function readConfigRaw(fluxDir: string): FluxConfig {
  const configPath = resolve(fluxDir, 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8')) as FluxConfig;
    } catch {
      return {};
    }
  }
  return {};
}

// Read config from .flux/config.json (expands $ENV_VAR references)
export function readConfig(fluxDir: string): FluxConfig {
  const raw = readConfigRaw(fluxDir);
  return {
    ...raw,
    server: expandEnv(raw.server),
    apiKey: expandEnv(raw.apiKey),
  };
}

// Write config to .flux/config.json
export function writeConfig(fluxDir: string, config: FluxConfig): void {
  const configPath = resolve(fluxDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
