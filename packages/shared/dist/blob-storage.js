import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
function blobPath(blobsDir, hash) {
    const prefix = hash.slice(0, 2);
    return join(blobsDir, prefix, hash);
}
export function createFilesystemBlobStorage(blobsDir) {
    mkdirSync(blobsDir, { recursive: true });
    return {
        write(content) {
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
        read(hash) {
            const filePath = blobPath(blobsDir, hash);
            if (!existsSync(filePath))
                return null;
            return readFileSync(filePath);
        },
        exists(hash) {
            return existsSync(blobPath(blobsDir, hash));
        },
        remove(hash) {
            const filePath = blobPath(blobsDir, hash);
            if (!existsSync(filePath))
                return false;
            unlinkSync(filePath);
            return true;
        },
    };
}
// Global accessor
let blobStorage = null;
export function setBlobStorage(bs) {
    blobStorage = bs;
}
export function getBlobStorage() {
    return blobStorage;
}
