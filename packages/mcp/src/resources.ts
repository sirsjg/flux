import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getProjects,
  getProject,
  getProjectStats,
  getEpics,
  getTasks,
  isTaskBlocked,
} from '@flux/shared/client';

const json = (uri: string, data: unknown) => ({
  contents: [
    {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    },
  ],
});

export function registerResources(server: McpServer): void {
  server.registerResource(
    'projects',
    'flux://projects',
    {
      title: 'All Projects',
      description: 'List of all Flux projects',
      mimeType: 'application/json',
    },
    async (uri) => {
      const projectList = await getProjects();
      const projects = await Promise.all(
        projectList.map(async (p) => ({
          ...p,
          stats: await getProjectStats(p.id),
        }))
      );
      return json(uri.href, projects);
    }
  );

  server.registerResource(
    'project',
    new ResourceTemplate('flux://projects/{projectId}', {
      list: async () => {
        const projects = await getProjects();
        return {
          resources: projects.map((p) => ({
            uri: `flux://projects/${p.id}`,
            name: p.name,
            description: p.description || `Project: ${p.name}`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Project',
      description: 'A single Flux project with stats',
      mimeType: 'application/json',
    },
    async (uri, { projectId }) => {
      const id = String(projectId);
      const project = await getProject(id);
      if (!project) {
        throw new Error(`Project not found: ${id}`);
      }
      return json(uri.href, { ...project, stats: await getProjectStats(project.id) });
    }
  );

  server.registerResource(
    'project-epics',
    new ResourceTemplate('flux://projects/{projectId}/epics', {
      list: async () => {
        const projects = await getProjects();
        return {
          resources: projects.map((p) => ({
            uri: `flux://projects/${p.id}/epics`,
            name: `${p.name} - Epics`,
            description: `Epics in ${p.name}`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Project Epics',
      description: 'Epics in a Flux project',
      mimeType: 'application/json',
    },
    async (uri, { projectId }) => {
      const epics = await getEpics(String(projectId));
      return json(uri.href, epics);
    }
  );

  server.registerResource(
    'project-tasks',
    new ResourceTemplate('flux://projects/{projectId}/tasks', {
      list: async () => {
        const projects = await getProjects();
        return {
          resources: projects.map((p) => ({
            uri: `flux://projects/${p.id}/tasks`,
            name: `${p.name} - Tasks`,
            description: `Tasks in ${p.name}`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Project Tasks',
      description: 'Tasks in a Flux project with blocked status',
      mimeType: 'application/json',
    },
    async (uri, { projectId }) => {
      const taskList = await getTasks(String(projectId));
      const tasks = await Promise.all(
        taskList.map(async (t) => ({
          ...t,
          blocked: await isTaskBlocked(t.id),
        }))
      );
      return json(uri.href, tasks);
    }
  );
}
