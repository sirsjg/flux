import { resolve, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export type FluxConfig = {
  server?: string;    // Server URL (server mode)
  dataFile?: string;  // Local data file path (file mode)
};

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

// Read config from .flux/config.json
export function readConfig(fluxDir: string): FluxConfig {
  const configPath = resolve(fluxDir, 'config.json');
  if (existsSync(configPath)) {
    try {
      return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      return {};
    }
  }
  return {};
}

// Write config to .flux/config.json
export function writeConfig(fluxDir: string, config: FluxConfig): void {
  const configPath = resolve(fluxDir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
