export interface BlobStorageProvider {
    write(content: Buffer): {
        hash: string;
        size: number;
    };
    read(hash: string): Buffer | null;
    exists(hash: string): boolean;
    remove(hash: string): boolean;
}
export declare function createFilesystemBlobStorage(blobsDir: string): BlobStorageProvider;
export declare function setBlobStorage(bs: BlobStorageProvider): void;
export declare function getBlobStorage(): BlobStorageProvider | null;
