import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from '../client.js';
import { output } from '../index.js';
import { writeConfig, readConfigRaw, findFluxDir } from '../config.js';

export async function projectCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
  currentProject?: string
): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const projects = await getProjects();
      const withStats = await Promise.all(
        projects.map(async p => ({
          ...p,
          stats: await getProjectStats(p.id),
          current: p.id === currentProject,
        }))
      );
      if (json) {
        output(withStats, true);
      } else {
        if (withStats.length === 0) {
          console.log('No projects');
        } else {
          for (const p of withStats) {
            const marker = p.current ? ' *' : '';
            const vis = p.visibility === 'private' ? ' [private]' : '';
            console.log(`${p.id}  ${p.name}  (${p.stats.done}/${p.stats.total} done)${vis}${marker}`);
          }
        }
      }
      break;
    }

    case 'use': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux project use <id>');
        process.exit(1);
      }
      const project = await getProject(id);
      if (!project) {
        console.error(`Project not found: ${id}`);
        process.exit(1);
      }
      const fluxDir = findFluxDir();
      const config = readConfigRaw(fluxDir);  // Use raw to preserve $ENV_VAR refs
      config.project = id;
      writeConfig(fluxDir, config);
      output(json ? { project: id } : `Now using project: ${project.name} (${id})`, json);
      break;
    }

    case 'create': {
      const name = args[0];
      if (!name) {
        console.error('Usage: flux project create <name> [--private|--public]');
        process.exit(1);
      }
      if (flags.private === true && flags.public === true) {
        console.error('Cannot pass both --private and --public');
        process.exit(1);
      }
      const desc = flags.desc as string | undefined;
      // Projects are private unless --public is given.
      const visibility = flags.public === true ? 'public' : 'private';
      const project = await createProject(name, desc, visibility);
      // Label from the stored value rather than the request, so the output
      // reflects what the server actually did.
      const label = project.visibility === 'public' ? ' (public)' : ' (private)';
      output(json ? project : `Created project: ${project.id}${label}`, json);
      break;
    }

    case 'update': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux project update <id> [--name] [--desc] [--private|--public]');
        process.exit(1);
      }
      const updates: { name?: string; description?: string; visibility?: 'public' | 'private' } = {};
      if (flags.name) updates.name = flags.name as string;
      if (flags.desc) updates.description = flags.desc as string;
      if (flags.private === true) updates.visibility = 'private';
      if (flags.public === true) updates.visibility = 'public';
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
      console.error('Usage: flux project [list|create|update|delete|use]');
      process.exit(1);
  }
}
