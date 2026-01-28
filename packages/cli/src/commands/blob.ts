import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename, resolve, extname } from 'path';
import {
  uploadBlob,
  downloadBlob,
  getClientBlobs,
  deleteBlobClient,
} from '../client.js';
import { output } from '../index.js';

// Simple MIME type lookup by extension
function guessMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.csv': 'text/csv',
    '.xml': 'application/xml',
    '.yaml': 'application/yaml',
    '.yml': 'application/yaml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.wav': 'audio/wav',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return types[ext] || 'application/octet-stream';
}

export async function blobCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean | string[]>,
  json: boolean
): Promise<void> {
  switch (subcommand) {
    case 'attach': {
      const taskId = args[0];
      const filePath = args[1];
      if (!taskId || !filePath) {
        console.error('Usage: flux blob attach <task-id> <file-path>');
        process.exit(1);
      }
      if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      const content = readFileSync(filePath);
      const filename = basename(filePath);
      const mime_type = guessMimeType(filename);
      const blob = await uploadBlob(Buffer.from(content), filename, mime_type, taskId);
      if (json) {
        output(blob, true);
      } else {
        console.log(`Attached ${filename} (${formatSize(blob.size)}) to task ${taskId}`);
        console.log(`Blob ID: ${blob.id}`);
      }
      break;
    }

    case 'get': {
      const blobId = args[0];
      const outputPath = args[1];
      if (!blobId) {
        console.error('Usage: flux blob get <blob-id> [output-path]');
        process.exit(1);
      }
      const result = await downloadBlob(blobId);
      if (!result) {
        console.error('Blob not found');
        process.exit(1);
      }
      const destPath = outputPath || resolve(process.cwd(), result.blob.filename);
      writeFileSync(destPath, result.content);
      if (json) {
        output({ path: destPath, ...result.blob }, true);
      } else {
        console.log(`Downloaded ${result.blob.filename} (${formatSize(result.blob.size)}) to ${destPath}`);
      }
      break;
    }

    case 'list': {
      const taskId = flags.task as string | undefined;
      const blobs = await getClientBlobs(taskId ? { task_id: taskId } : undefined);
      if (json) {
        output(blobs, true);
      } else if (blobs.length === 0) {
        console.log('No blobs found');
      } else {
        for (const b of blobs) {
          const taskLabel = b.task_id ? ` (task: ${b.task_id})` : '';
          console.log(`${b.id}  ${b.filename}  ${formatSize(b.size)}  ${b.mime_type}${taskLabel}`);
        }
      }
      break;
    }

    case 'delete': {
      const blobId = args[0];
      if (!blobId) {
        console.error('Usage: flux blob delete <blob-id>');
        process.exit(1);
      }
      const success = await deleteBlobClient(blobId);
      if (!success) {
        console.error('Blob not found');
        process.exit(1);
      }
      if (json) {
        output({ success: true }, true);
      } else {
        console.log(`Deleted blob ${blobId}`);
      }
      break;
    }

    default:
      console.log(`Usage: flux blob <attach|get|list|delete>

  flux blob attach <task-id> <file-path>   Attach a file to a task
  flux blob get <blob-id> [output-path]    Download blob to file
  flux blob list [--task <id>]             List blobs
  flux blob delete <blob-id>               Delete a blob`);
      break;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
