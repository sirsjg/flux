import { getReadyTasks, getProjects } from '@flux/shared';
import { output } from '../index.js';

export async function readyCommand(
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean
): Promise<void> {
  const projectId = args[0] || (flags.p as string) || (flags.project as string);

  const tasks = getReadyTasks(projectId);

  if (json) {
    output(tasks, true);
  } else {
    if (tasks.length === 0) {
      console.log('No ready tasks');
    } else {
      console.log('Ready tasks (unblocked, sorted by priority):');
      console.log('');
      for (const t of tasks) {
        const priority = t.priority !== undefined ? `P${t.priority}` : 'P2';
        console.log(`${t.id}  ${priority}  [${t.status}]  ${t.title}`);
        if (t.notes) {
          console.log(`    → ${t.notes.split('\n')[0]}...`);
        }
      }
    }
  }
}
