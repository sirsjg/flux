import { getReadyTasks, getProjects, PRIORITY_CONFIG, type Priority } from '@flux/shared';

const RESET = '\x1b[0m';
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
        const p = t.priority ?? 2;
        const { label, ansi } = PRIORITY_CONFIG[p as Priority];
        console.log(`${t.id}  ${ansi}${label}${RESET}  [${t.status}]  ${t.title}`);
        // Show latest comment preview
        const lastComment = t.comments?.[t.comments.length - 1];
        if (lastComment) {
          const preview = lastComment.body.split('\n')[0].slice(0, 60);
          console.log(`    → ${preview}${lastComment.body.length > 60 ? '...' : ''}`);
        }
      }
    }
  }
}
