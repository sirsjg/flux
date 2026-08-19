import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from '@flux/shared/client';
import { projectSchema } from '../schemas.js';
import { errorResult, structuredResult, textResult } from './util.js';

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List Projects',
      description: 'List all Flux projects with their stats',
      inputSchema: {},
      outputSchema: { projects: z.array(projectSchema) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const projectList = await getProjects();
      const projects = await Promise.all(
        projectList.map(async (p) => ({
          ...p,
          stats: await getProjectStats(p.id),
        }))
      );
      return structuredResult({ projects });
    }
  );

  server.registerTool(
    'create_project',
    {
      title: 'Create Project',
      description: 'Create a new Flux project',
      inputSchema: {
        name: z.string().describe('Project name'),
        description: z.string().optional().describe('Optional project description'),
      },
      outputSchema: { project: projectSchema },
      annotations: { openWorldHint: false },
    },
    async ({ name, description }) => {
      const project = await createProject(name, description);
      return structuredResult(
        { project },
        `Created project "${project.name}" with ID: ${project.id}`
      );
    }
  );

  server.registerTool(
    'update_project',
    {
      title: 'Update Project',
      description: 'Update an existing project',
      inputSchema: {
        project_id: z.string().describe('Project ID'),
        name: z.string().optional().describe('New project name'),
        description: z.string().optional().describe('New project description'),
      },
      outputSchema: { project: projectSchema },
      annotations: { idempotentHint: true, openWorldHint: false },
    },
    async ({ project_id, name, description }) => {
      const updates: Record<string, string> = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;
      const project = await updateProject(project_id, updates);
      if (!project) return errorResult('Project not found');
      return structuredResult({ project }, `Updated project: ${JSON.stringify(project, null, 2)}`);
    }
  );

  server.registerTool(
    'delete_project',
    {
      title: 'Delete Project',
      description: 'Delete a project and all its epics and tasks',
      inputSchema: {
        project_id: z.string().describe('Project ID to delete'),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ project_id }) => {
      await deleteProject(project_id);
      return textResult(`Deleted project ${project_id}`);
    }
  );
}
