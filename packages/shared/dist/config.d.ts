import type { SyncConfig } from './sync-types.js';
export type FluxConfig = {
    server?: string;
    apiKey?: string;
    dataFile?: string;
    project?: string;
    sync?: SyncConfig;
};
export declare function findFluxDir(): string;
export declare function loadEnvLocal(fluxDir: string): void;
export declare function readConfigRaw(fluxDir: string): FluxConfig;
export declare function readConfig(fluxDir: string): FluxConfig;
export declare function writeConfig(fluxDir: string, config: FluxConfig): void;
export declare function resolveDataPath(fluxDir: string, config: FluxConfig): string;
