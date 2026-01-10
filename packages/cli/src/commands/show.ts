import { getTask, isTaskBlocked, getEpic, getProject, PRIORITY_CONFIG, type Priority } from '@flux/shared';

const RESET = '\x1b[0m';
import { output } from '../index.js';

export async function showCommand(
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean
): Promise<void> {
  const id = args[0];
  if (!id) {
    console.error('Usage: flux show <id> [--json]');
    process.exit(1);
  }

  const task = getTask(id);
  if (!task) {
    console.error(`Task not found: ${id}`);
    process.exit(1);
  }

  const blocked = isTaskBlocked(id);
  const epic = task.epic_id ? getEpic(task.epic_id) : undefined;
  const project = getProject(task.project_id);

  const result = {
    ...task,
    blocked,
    epic_title: epic?.title,
    project_name: project?.name,
  };

  if (json) {
    output(result, true);
  } else {
    const p = task.priority ?? 2;
    const { label: priority, ansi } = PRIORITY_CONFIG[p as Priority];
    console.log(`Task: ${task.id}`);
    console.log(`Title: ${task.title}`);
    console.log(`Status: ${task.status}${blocked ? ' [BLOCKED]' : ''}`);
    console.log(`Priority: ${ansi}${priority}${RESET}`);
    if (project) console.log(`Project: ${project.name}`);
    if (epic) console.log(`Epic: ${epic.title}`);
    if (task.depends_on.length > 0) {
      console.log(`Depends on: ${task.depends_on.join(', ')}`);
    }
    if (task.created_at) console.log(`Created: ${task.created_at}`);
    if (task.updated_at) console.log(`Updated: ${task.updated_at}`);

    if (task.notes) {
      console.log('');
      console.log('Notes:');
      console.log(task.notes);
    }
  }
}
