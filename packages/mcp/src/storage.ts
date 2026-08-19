import { join } from 'path';
import { initClient } from '@flux/shared/client';
import { setStorageAdapter, initStore } from '@flux/shared';
import { findFluxDir, loadEnvLocal, readConfig, resolveDataPath } from '@flux/shared/config';
import { createAdapter } from '@flux/shared/adapters';
import { createFilesystemBlobStorage, setBlobStorage } from '@flux/shared/blob-storage';

/**
 * Initialize storage using the same config resolution as the CLI.
 * Remote server mode when FLUX_SERVER/config.server is set, otherwise
 * local JSON/SQLite storage plus filesystem blob storage.
 */
export function bootstrapStorage(): void {
  const fluxDir = findFluxDir();
  loadEnvLocal(fluxDir);
  const config = readConfig(fluxDir);

  const serverUrl = process.env.FLUX_SERVER || config.server;
  const apiKey = process.env.FLUX_API_KEY || config.apiKey;

  if (serverUrl) {
    initClient(serverUrl, apiKey);
    console.error(`Flux MCP using remote server: ${serverUrl}`);
  } else {
    const dataPath = resolveDataPath(fluxDir, config);
    const adapter = createAdapter(dataPath);
    setStorageAdapter(adapter);
    initStore();
    initClient();
    setBlobStorage(createFilesystemBlobStorage(join(fluxDir, 'blobs')));
    console.error(`Flux MCP using local storage: ${dataPath}`);
  }
}
