import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface BlobStorageProvider {
  write(content: Buffer): { hash: string; size: number };
  read(hash: string): Buffer | null;
  exists(hash: string): boolean;
  remove(hash: string): boolean;
}

function blobPath(blobsDir: string, hash: string): string {
  const prefix = hash.slice(0, 2);
  return join(blobsDir, prefix, hash);
}

export function createFilesystemBlobStorage(blobsDir: string): BlobStorageProvider {
  mkdirSync(blobsDir, { recursive: true });

  return {
    write(content: Buffer): { hash: string; size: number } {
      const hash = createHash('sha256').update(content).digest('hex');
      const size = content.length;
      const filePath = blobPath(blobsDir, hash);

      if (!existsSync(filePath)) {
        const prefixDir = join(blobsDir, hash.slice(0, 2));
        mkdirSync(prefixDir, { recursive: true });
        writeFileSync(filePath, content);
      }

      return { hash, size };
    },

    read(hash: string): Buffer | null {
      const filePath = blobPath(blobsDir, hash);
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath);
    },

    exists(hash: string): boolean {
      return existsSync(blobPath(blobsDir, hash));
    },

    remove(hash: string): boolean {
      const filePath = blobPath(blobsDir, hash);
      if (!existsSync(filePath)) return false;
      unlinkSync(filePath);
      return true;
    },
  };
}

// Global accessor
let blobStorage: BlobStorageProvider | null = null;

export function setBlobStorage(bs: BlobStorageProvider): void {
  blobStorage = bs;
}

export function getBlobStorage(): BlobStorageProvider | null {
  return blobStorage;
}
