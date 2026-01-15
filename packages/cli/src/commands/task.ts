import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  isTaskBlocked,
  PRIORITY_CONFIG,
  PRIORITIES,
  type Priority,
  type Guardrail,
} from '../client.js';

const RESET = '\x1b[0m';
import { output } from '../index.js';

// Parse guardrail format: "999:text" or "999:\"text with spaces\""
function parseGuardrail(s: string): Guardrail | null {
  const colonIdx = s.indexOf(':');
  if (colonIdx === -1) return null;
  const num = parseInt(s.slice(0, colonIdx), 10);
  if (isNaN(num) || num <= 0) return null;
  const text = s.slice(colonIdx + 1).trim();
  if (!text) return null;
  return { id: crypto.randomUUID(), number: num, text };
}

export async function taskCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
  defaultProject?: string
): Promise<void> {
  switch (subcommand) {
    case 'list': {
      const projectId = args[0] || defaultProject;
      if (!projectId) {
        console.error('Usage: flux task list [project] [--epic] [--status]');
        console.error('Tip: Set default project with: flux project use <id>');
        process.exit(1);
      }
      const rawTasks = await getTasks(projectId);
      let tasks = await Promise.all(
        rawTasks.map(async t => ({
          ...t,
          blocked: await isTaskBlocked(t.id),
        }))
      );

      // Filter by epic
      if (flags.epic) {
        tasks = tasks.filter(t => t.epic_id === flags.epic);
      }
      // Filter by status
      if (flags.status) {
        tasks = tasks.filter(t => t.status === flags.status);
      }

      if (json) {
        output(tasks, true);
      } else {
        if (tasks.length === 0) {
          console.log('No tasks');
        } else {
          for (const t of tasks) {
            const p = t.priority ?? 2;
            const { label, ansi } = PRIORITY_CONFIG[p as Priority];
            const blockedInfo = t.blocked_reason
              ? ` [BLOCKED: ${t.blocked_reason}]`
              : t.blocked ? ' [BLOCKED]' : '';
            console.log(`${t.id}  ${ansi}${label}${RESET}  [${t.status}]  ${t.title}${blockedInfo}`);
          }
        }
      }
      break;
    }

    case 'create': {
      // Support: flux task create <title> (with default project) or flux task create <project> <title>
      let projectId: string | undefined;
      let title: string | undefined;
      if (args.length === 1 && defaultProject) {
        projectId = defaultProject;
        title = args[0];
      } else {
        projectId = args[0];
        title = args[1];
      }
      if (!projectId || !title) {
        console.error('Usage: flux task create [project] <title> [-P priority] [-e epic] [-d|--depends id,...] [--note] [--ac ...] [--guardrail ...]');
        console.error('Tip: Set default project with: flux project use <id>');
        process.exit(1);
      }
      const epicId = (flags.e || flags.epic) as string | undefined;
      const priorityStr = (flags.P || flags.priority) as string | undefined;
      const priority = priorityStr !== undefined && PRIORITIES.includes(parseInt(priorityStr, 10) as Priority)
        ? parseInt(priorityStr, 10) as Priority
        : undefined;
      const dependsStr = (flags.depends || flags.d) as string | undefined;
      const depends_on = dependsStr ? dependsStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;

      // Parse acceptance criteria (--ac can be repeated)
      const acRaw = flags.ac;
      const acceptance_criteria = Array.isArray(acRaw) ? acRaw : (acRaw ? [acRaw as string] : undefined);

      // Parse guardrails (--guardrail "999:text")
      const guardrailRaw = flags.guardrail;
      let guardrails: Guardrail[] | undefined;
      if (guardrailRaw) {
        const items = Array.isArray(guardrailRaw) ? guardrailRaw : [guardrailRaw as string];
        const parsed = items.map(s => ({ input: s, result: parseGuardrail(s) }));
        for (const { input, result } of parsed) {
          if (!result) console.error(`Warning: invalid guardrail format "${input}" (expected "999:text")`);
        }
        guardrails = parsed.map(p => p.result).filter((g): g is Guardrail => g !== null);
        if (guardrails.length === 0) guardrails = undefined;
      }

      const task = await createTask(projectId, title, epicId, { priority, depends_on, acceptance_criteria, guardrails });
      // Add initial comment if --note provided
      if (flags.note) {
        await addTaskComment(task.id, flags.note as string, 'user');
      }
      output(json ? task : `Created task: ${task.id}`, json);
      break;
    }

    case 'update': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux task update <id> [--title] [--status] [--note] [--epic] [-d|--depends id,...] [--blocked "reason"|clear] [--ac ...] [--guardrail ...] [--clear-ac] [--clear-guardrails]');
        process.exit(1);
      }

      // Handle adding a comment
      if (flags.note) {
        const comment = await addTaskComment(id, flags.note as string, 'user');
        if (!comment) {
          console.error(`Task not found: ${id}`);
          process.exit(1);
        }
        if (!flags.title && !flags.status && !flags.epic && !flags.P && !flags.priority && flags.blocked === undefined && !flags.ac && !flags.guardrail && !flags['clear-ac'] && !flags['clear-guardrails']) {
          const task = await getTask(id);
          output(json ? task : `Added comment to task: ${id}`, json);
          return;
        }
      }

      const updates: { title?: string; status?: string; epic_id?: string; priority?: Priority; blocked_reason?: string; depends_on?: string[]; acceptance_criteria?: string[]; guardrails?: Guardrail[] } = {};
      if (flags.title) updates.title = flags.title as string;
      if (flags.status) updates.status = flags.status as string;
      if (flags.epic) updates.epic_id = flags.epic as string;
      if (flags.P || flags.priority) {
        updates.priority = parseInt((flags.P || flags.priority) as string, 10) as Priority;
      }
      if (flags.depends || flags.d) {
        const dependsStr = (flags.depends || flags.d) as string;
        updates.depends_on = dependsStr.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (flags.blocked !== undefined) {
        // Handle --blocked flag: string value sets blocker, "clear" or "-" clears
        if (flags.blocked === true) {
          console.error('--blocked requires a reason string. Use --blocked clear to remove blocker.');
          process.exit(1);
        }
        const blockedVal = flags.blocked as string;
        updates.blocked_reason = (blockedVal === 'clear' || blockedVal === '-' || blockedVal === '') ? undefined : blockedVal;
      }

      // Parse acceptance criteria (--ac can be repeated) or clear with --clear-ac
      if (flags['clear-ac']) {
        updates.acceptance_criteria = [];
      } else if (flags.ac) {
        const acRaw = flags.ac;
        updates.acceptance_criteria = Array.isArray(acRaw) ? acRaw : [acRaw as string];
      }

      // Parse guardrails (--guardrail "999:text") or clear with --clear-guardrails
      if (flags['clear-guardrails']) {
        updates.guardrails = [];
      } else if (flags.guardrail) {
        const guardrailRaw = flags.guardrail;
        const items = Array.isArray(guardrailRaw) ? guardrailRaw : [guardrailRaw as string];
        const parsed = items.map(s => ({ input: s, result: parseGuardrail(s) }));
        for (const { input, result } of parsed) {
          if (!result) console.error(`Warning: invalid guardrail format "${input}" (expected "999:text")`);
        }
        const valid = parsed.map(p => p.result).filter((g): g is Guardrail => g !== null);
        if (valid.length > 0) updates.guardrails = valid;
      }

      const task = await updateTask(id, updates);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      output(json ? task : `Updated task: ${task.id}`, json);
      break;
    }

    case 'delete': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux task delete <id>');
        process.exit(1);
      }
      const task = await getTask(id);
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      await deleteTask(id);
      output(json ? { deleted: id } : `Deleted task: ${id}`, json);
      break;
    }

    case 'done': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux task done <id> [--note]');
        process.exit(1);
      }

      // Add comment if provided
      if (flags.note) {
        await addTaskComment(id, flags.note as string, 'user');
      }

      const task = await updateTask(id, { status: 'done' });
      if (!task) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }
      output(json ? task : `Completed task: ${task.id}`, json);
      break;
    }

    case 'start': {
      const id = args[0];
      if (!id) {
        console.error('Usage: flux task start <id>');
        process.exit(1);
      }

      const current = await getTask(id);
      if (!current) {
        console.error(`Task not found: ${id}`);
        process.exit(1);
      }

      // Check workflow: planning -> todo -> in_progress
      if (current.status === 'planning') {
        console.error('Task is in planning. Move to todo first: flux task update <id> --status todo');
        process.exit(1);
      }

      const task = await updateTask(id, { status: 'in_progress' });
      output(json ? task : `Started task: ${task!.id}`, json);
      break;
    }

    default:
      console.error('Usage: flux task [list|create|update|delete|done|start]');
      process.exit(1);
  }
}
