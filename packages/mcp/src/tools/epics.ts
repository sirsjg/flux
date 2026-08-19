import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getEpics, createEpic, updateEpic, deleteEpic } from '@flux/shared/client';
import { epicSchema, statusSchema } from '../schemas.js';
import { errorResult, structuredResult, textResult } from './util.js';

export function registerEpicTools(server: McpServer): void {
  server.registerTool(
    'list_epics',
    {
      title: 'List Epics',
      description: 'List all epics in a project',
      inputSchema: {
        project_id: z.string().describe('Project ID'),
      },
      outputSchema: { epics: z.array(epicSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ project_id }) => {
      const epics = await getEpics(project_id);
      return structuredResult({ epics });
    }
  );

  server.registerTool(
    'create_epic',
    {
      title: 'Create Epic',
      description: 'Create a new epic in a project',
      inputSchema: {
        project_id: z.string().describe('Project ID'),
        title: z.string().describe('Epic title'),
        notes: z.string().optional().describe('Optional epic notes'),
        auto: z.boolean().optional().describe('Optional auto flag (defaults to false)'),
      },
      outputSchema: { epic: epicSchema },
      annotations: { openWorldHint: false },
    },
    async ({ project_id, title, notes, auto }) => {
      const epic = await createEpic(project_id, title, notes, auto);
      return structuredResult({ epic }, `Created epic "${epic.title}" with ID: ${epic.id}`);
    }
  );

  server.registerTool(
    'update_epic',
    {
      title: 'Update Epic',
      description: 'Update an existing epic',
      inputSchema: {
        epic_id: z.string().describe('Epic ID'),
        title: z.string().optional().describe('New epic title'),
        notes: z.string().optional().describe('New epic notes'),
        status: statusSchema.optional().describe('New epic status (todo, in_progress, done)'),
        depends_on: z.array(z.string()).optional().describe('IDs of epics this epic depends on'),
        auto: z.boolean().optional().describe('Enable or disable auto for the epic'),
      },
      outputSchema: { epic: epicSchema },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ epic_id, title, notes, status, depends_on, auto }) => {
      const updates: Record<string, unknown> = {};
      if (title) updates.title = title;
      if (notes !== undefined) updates.notes = notes;
      if (status) updates.status = status;
      if (depends_on) updates.depends_on = depends_on;
      if (auto !== undefined) updates.auto = auto;
      const epic = await updateEpic(epic_id, updates);
      if (!epic) return errorResult('Epic not found');
      return structuredResult({ epic }, `Updated epic: ${JSON.stringify(epic, null, 2)}`);
    }
  );

  server.registerTool(
    'delete_epic',
    {
      title: 'Delete Epic',
      description: 'Delete an epic (tasks will become unassigned)',
      inputSchema: {
        epic_id: z.string().describe('Epic ID to delete'),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ epic_id }) => {
      const success = await deleteEpic(epic_id);
      if (!success) return errorResult('Epic not found');
      return textResult(`Deleted epic ${epic_id}`);
    }
  );
}
