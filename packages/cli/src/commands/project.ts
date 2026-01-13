import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from '../client.js';
import { output } from '../index.js';

export async function projectCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean
): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const projects = await getProjects();
      const withStats = await Promise.all(
        projects.map(async p => ({
          ...p,
          stats: await getProjectStats(p.id),
        }))
      );
      if (json) {
        output(withStats, true);
      } else {
        if (withStats.length === 0) {
          console.log('No projects');
        } else {
          for (const p of withStats) {
            console.log(`${p.id}  ${p.name}  (${p.stats.done}/${p.stats.total} done)`);
          }
        }
      }
      break;
    }

    case 'create': {
      const name = args[0];
      if (!name) {
        console.error('Usage: flux project create <name>');
        process.exit(1);
      }
      const desc = flags.desc as string | undefined;
      const project = await createProject(name, desc);
      output(json ? project : `Created project: ${project.id}`, json);
      break;
    }

    case 'update': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux project update <id> [--name] [--desc]');
        process.exit(1);
      }
      const updates: { name?: string; description?: string } = {};
      if (flags.name) updates.name = flags.name as string;
      if (flags.desc) updates.description = flags.desc as string;
      const project = await updateProject(id, updates);
      if (!project) {
        console.error(`Project not found: ${id}`);
        process.exit(1);
      }
      output(json ? project : `Updated project: ${project.id}`, json);
      break;
    }

    case 'delete': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux project delete <id>');
        process.exit(1);
      }
      const project = await getProject(id);
      if (!project) {
        console.error(`Project not found: ${id}`);
        process.exit(1);
      }
      await deleteProject(id);
      output(json ? { deleted: id } : `Deleted project: ${id}`, json);
      break;
    }

    default:
      console.error('Usage: flux project [list|create|update|delete]');
      process.exit(1);
  }
}
