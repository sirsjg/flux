import { getProject, getProjectContext, updateProjectContext, addProjectContextNote } from '../client.js';
import { output } from '../index.js';
import type { ProjectContext } from '@flux/shared';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

export async function contextCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean | string[]>,
  json: boolean
): Promise<void> {
  switch (subcommand) {
    case 'show': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux context show <project-id>');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      const context = await getProjectContext(projectId);

      if (json) {
        output({ project: project.name, context: context || null }, true);
        return;
      }

      console.log(`${c.bold}Context: ${project.name}${c.reset}\n`);

      if (!context) {
        console.log(`${c.dim}No context set. Use 'flux context set' to add one.${c.reset}`);
        return;
      }

      if (context.problem) {
        console.log(`${c.bold}Problem${c.reset}`);
        console.log(`  ${context.problem}\n`);
      }

      if (context.businessRules?.length) {
        console.log(`${c.bold}Business Rules${c.reset}`);
        context.businessRules.forEach((rule, i) => {
          console.log(`  ${c.yellow}${i + 1}.${c.reset} ${rule}`);
        });
        console.log('');
      }

      if (context.notes) {
        console.log(`${c.bold}Session Notes${c.reset}`);
        console.log(`${c.dim}${context.notes}${c.reset}`);
      }
      break;
    }

    case 'set': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux context set <project-id> [--problem "..."] [--rule "..."]');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      const existing = await getProjectContext(projectId) || {};
      const context: ProjectContext = { ...existing };

      if (flags.problem) {
        context.problem = flags.problem as string;
      }

      if (flags.rule) {
        const rules = Array.isArray(flags.rule) ? flags.rule : [flags.rule as string];
        context.businessRules = [...(context.businessRules || []), ...rules];
      }

      if (flags['clear-rules']) {
        context.businessRules = [];
      }

      const updated = await updateProjectContext(projectId, context);
      if (!updated) {
        console.error('Failed to update context');
        process.exit(1);
      }

      if (json) {
        output(updated, true);
      } else {
        console.log(`Updated context for ${project.name}`);
      }
      break;
    }

    case 'note': {
      const projectId = args[0];
      const note = args.slice(1).join(' ') || (flags.m as string);

      if (!projectId || !note) {
        console.error('Usage: flux context note <project-id> <note>');
        console.error('       flux context note <project-id> -m "note"');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      const updated = await addProjectContextNote(projectId, note);
      if (!updated) {
        console.error('Failed to add note');
        process.exit(1);
      }

      if (json) {
        output(updated, true);
      } else {
        console.log(`Added note to ${project.name}`);
      }
      break;
    }

    default:
      console.error(`Usage: flux context <command> [options]

Commands:
  show <project-id>                    Display project context
  set <project-id> [options]           Set context fields
  note <project-id> <note>             Add session note

Options for 'set':
  --problem "..."     Set problem statement
  --rule "..."        Add business rule (can repeat)
  --clear-rules       Clear all business rules
`);
      process.exit(1);
  }
}
