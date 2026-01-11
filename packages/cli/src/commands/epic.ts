import {
  getEpics,
  getEpic,
  createEpic,
  updateEpic,
  deleteEpic,
} from '../client.js';
import { output } from '../index.js';

export async function epicCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean
): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux epic list <project>');
        process.exit(1);
      }
      const epics = await getEpics(projectId);
      if (json) {
        output(epics, true);
      } else {
        if (epics.length === 0) {
          console.log('No epics');
        } else {
          for (const e of epics) {
            console.log(`${e.id}  [${e.status}]  ${e.title}`);
          }
        }
      }
      break;
    }

    case 'create': {
      const projectId = args[0];
      const title = args[1];
      if (!projectId || !title) {
        console.error('Usage: flux epic create <project> <title>');
        process.exit(1);
      }
      const notes = (flags.note || flags.notes) as string | undefined;
      const epic = await createEpic(projectId, title, notes);
      output(json ? epic : `Created epic: ${epic.id}`, json);
      break;
    }

    case 'update': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux epic update <id> [--title] [--status] [--note]');
        process.exit(1);
      }
      const updates: { title?: string; status?: string; notes?: string } = {};
      if (flags.title) updates.title = flags.title as string;
      if (flags.status) updates.status = flags.status as string;
      if (flags.note || flags.notes) updates.notes = (flags.note || flags.notes) as string;
      const epic = await updateEpic(id, updates);
      if (!epic) {
        console.error(`Epic not found: ${id}`);
        process.exit(1);
      }
      output(json ? epic : `Updated epic: ${epic.id}`, json);
      break;
    }

    case 'delete': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux epic delete <id>');
        process.exit(1);
      }
      const epic = await getEpic(id);
      if (!epic) {
        console.error(`Epic not found: ${id}`);
        process.exit(1);
      }
      await deleteEpic(id);
      output(json ? { deleted: id } : `Deleted epic: ${id}`, json);
      break;
    }

    default:
      console.error('Usage: flux epic [list|create|update|delete]');
      process.exit(1);
  }
}
