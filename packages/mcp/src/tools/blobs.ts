import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { basename, extname } from 'path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { uploadBlob, downloadBlob, getClientBlobs, deleteBlobClient } from '@flux/shared/client';
import { blobMetadataSchema } from '../schemas.js';
import { errorResult, structuredResult, textResult } from './util.js';

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  html: 'text/html',
  xml: 'application/xml',
  zip: 'application/zip',
  gz: 'application/gzip',
  log: 'text/plain',
  yaml: 'text/yaml',
  yml: 'text/yaml',
};

export function registerBlobTools(server: McpServer): void {
  server.registerTool(
    'blob_attach',
    {
      title: 'Attach File to Task',
      description:
        'Attach a file to a task. Provide the absolute file path and the MCP server reads it directly from disk.',
      inputSchema: {
        task_id: z.string().describe('Task ID to attach the blob to'),
        file_path: z.string().describe('Absolute path to the file on disk'),
        mime_type: z
          .string()
          .optional()
          .describe('MIME type (e.g., "image/png"). Auto-detected from extension if omitted.'),
      },
      outputSchema: {
        blob_id: z.string(),
        hash: z.string(),
        size: z.number(),
        filename: z.string(),
      },
      annotations: { openWorldHint: false },
    },
    async ({ task_id, file_path, mime_type }) => {
      try {
        if (!existsSync(file_path)) {
          return errorResult(`File not found: ${file_path}`);
        }
        const content = readFileSync(file_path);
        const filename = basename(file_path);
        const ext = extname(file_path).toLowerCase().slice(1);
        const resolvedMime = mime_type || MIME_MAP[ext] || 'application/octet-stream';
        const blob = await uploadBlob(content, filename, resolvedMime, task_id);
        return structuredResult({ blob_id: blob.id, hash: blob.hash, size: blob.size, filename });
      } catch (err) {
        return errorResult(`Error attaching file: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  server.registerTool(
    'blob_get',
    {
      title: 'Get Blob',
      description: "Retrieve a blob's content and metadata by ID. Returns base64-encoded content.",
      inputSchema: {
        blob_id: z.string().describe('Blob ID to retrieve'),
      },
      outputSchema: {
        blob_id: z.string(),
        filename: z.string(),
        mime_type: z.string(),
        size: z.number(),
        content_base64: z.string(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ blob_id }) => {
      const result = await downloadBlob(blob_id);
      if (!result) return errorResult('Blob not found');
      return structuredResult({
        blob_id: result.blob.id,
        filename: result.blob.filename,
        mime_type: result.blob.mime_type,
        size: result.blob.size,
        content_base64: result.content.toString('base64'),
      });
    }
  );

  server.registerTool(
    'blob_list',
    {
      title: 'List Blobs',
      description: 'List blobs, optionally filtered by task ID',
      inputSchema: {
        task_id: z.string().optional().describe('Optional: filter blobs by task ID'),
      },
      outputSchema: { blobs: z.array(blobMetadataSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ task_id }) => {
      const blobs = await getClientBlobs(task_id ? { task_id } : undefined);
      return structuredResult({
        blobs: blobs.map((b) => ({
          id: b.id,
          filename: b.filename,
          mime_type: b.mime_type,
          size: b.size,
          task_id: b.task_id,
          created_at: b.created_at,
        })),
      });
    }
  );

  server.registerTool(
    'blob_delete',
    {
      title: 'Delete Blob',
      description: 'Delete a blob by ID',
      inputSchema: {
        blob_id: z.string().describe('Blob ID to delete'),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ blob_id }) => {
      const success = await deleteBlobClient(blob_id);
      if (!success) return errorResult('Blob not found');
      return textResult(JSON.stringify({ success: true }));
    }
  );
}
