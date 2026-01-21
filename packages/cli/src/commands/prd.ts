import {
  getEpic,
  getEpicPRD,
  updateEpicPRD,
  getPRDCoverage,
  linkTaskToRequirements,
  linkTaskToPhase,
  getTask,
} from '../client.js';
import { output } from '../index.js';
import type { PRD, Requirement, Phase } from '@flux/shared';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

// Format requirement for display
function formatRequirement(req: Requirement, indent: string = ''): string {
  const priorityColor = req.priority === 'must' ? c.red : req.priority === 'should' ? c.yellow : c.gray;
  const typeLabel = req.type === 'functional' ? 'F' : req.type === 'non-functional' ? 'NF' : 'C';
  return `${indent}${c.cyan}${req.id}${c.reset} [${typeLabel}] ${priorityColor}${req.priority.toUpperCase()}${c.reset} ${req.description}${req.acceptance ? `\n${indent}  ${c.dim}Acceptance: ${req.acceptance}${c.reset}` : ''}`;
}

// Export PRD as markdown
function prdToMarkdown(epic: { title: string }, prd: PRD): string {
  const lines: string[] = [];
  lines.push(`# PRD: ${epic.title}`);
  lines.push('');

  lines.push('## Problem Statement');
  lines.push(prd.problem);
  lines.push('');

  lines.push('## Goals');
  prd.goals.forEach(g => lines.push(`- ${g}`));
  lines.push('');

  lines.push('## Requirements');
  lines.push('');

  const mustReqs = prd.requirements.filter(r => r.priority === 'must');
  const shouldReqs = prd.requirements.filter(r => r.priority === 'should');
  const couldReqs = prd.requirements.filter(r => r.priority === 'could');

  if (mustReqs.length) {
    lines.push('### Must Have');
    mustReqs.forEach(r => {
      lines.push(`- **${r.id}** [${r.type}]: ${r.description}`);
      if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`);
    });
    lines.push('');
  }

  if (shouldReqs.length) {
    lines.push('### Should Have');
    shouldReqs.forEach(r => {
      lines.push(`- **${r.id}** [${r.type}]: ${r.description}`);
      if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`);
    });
    lines.push('');
  }

  if (couldReqs.length) {
    lines.push('### Could Have');
    couldReqs.forEach(r => {
      lines.push(`- **${r.id}** [${r.type}]: ${r.description}`);
      if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`);
    });
    lines.push('');
  }

  lines.push('## Technical Approach');
  lines.push(prd.approach);
  lines.push('');

  if (prd.phases.length) {
    lines.push('## Phases');
    prd.phases.forEach(p => {
      lines.push(`### ${p.id}: ${p.name}`);
      lines.push(`Requirements: ${p.requirements.join(', ')}`);
      lines.push('');
    });
  }

  if (prd.risks.length) {
    lines.push('## Risks');
    prd.risks.forEach(r => lines.push(`- ${r}`));
    lines.push('');
  }

  if (prd.outOfScope.length) {
    lines.push('## Out of Scope');
    prd.outOfScope.forEach(o => lines.push(`- ${o}`));
    lines.push('');
  }

  lines.push('---');
  lines.push(`_Generated: ${new Date().toISOString()}_`);

  return lines.join('\n');
}

export async function prdCommand(
  subcommand: string | undefined,
  args: string[],
  flags: Record<string, string | boolean | string[]>,
  json: boolean
): Promise<void> {
  switch (subcommand) {
    case 'show': {
      const epicId = args[0];
      if (!epicId) {
        console.error('Usage: flux prd show <epic-id>');
        process.exit(1);
      }

      const epic = await getEpic(epicId);
      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }

      const prd = await getEpicPRD(epicId);
      if (!prd) {
        console.error(`No PRD found for epic: ${epicId}`);
        console.error(`Create one with: flux prd init ${epicId}`);
        process.exit(1);
      }

      if (json) {
        output({ epic, prd }, true);
        return;
      }

      console.log(`${c.bold}PRD: ${epic.title}${c.reset}\n`);

      console.log(`${c.bold}Problem${c.reset}`);
      console.log(`  ${prd.problem}\n`);

      console.log(`${c.bold}Goals${c.reset}`);
      prd.goals.forEach(g => console.log(`  • ${g}`));
      console.log('');

      console.log(`${c.bold}Requirements${c.reset}`);
      prd.requirements.forEach(r => console.log(formatRequirement(r, '  ')));
      console.log('');

      console.log(`${c.bold}Approach${c.reset}`);
      console.log(`  ${prd.approach}\n`);

      if (prd.phases.length) {
        console.log(`${c.bold}Phases${c.reset}`);
        prd.phases.forEach(p => {
          console.log(`  ${c.cyan}${p.id}${c.reset} ${p.name}`);
          console.log(`    ${c.dim}Requirements: ${p.requirements.join(', ')}${c.reset}`);
        });
        console.log('');
      }

      if (prd.risks.length) {
        console.log(`${c.bold}Risks${c.reset}`);
        prd.risks.forEach(r => console.log(`  ${c.yellow}⚠${c.reset} ${r}`));
        console.log('');
      }

      if (prd.outOfScope.length) {
        console.log(`${c.bold}Out of Scope${c.reset}`);
        prd.outOfScope.forEach(o => console.log(`  ${c.dim}✗${c.reset} ${o}`));
      }
      break;
    }

    case 'export': {
      const epicId = args[0];
      if (!epicId) {
        console.error('Usage: flux prd export <epic-id> [-o file.md]');
        process.exit(1);
      }

      const epic = await getEpic(epicId);
      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }

      const prd = await getEpicPRD(epicId);
      if (!prd) {
        console.error(`No PRD found for epic: ${epicId}`);
        process.exit(1);
      }

      const markdown = prdToMarkdown(epic, prd);

      const outFile = flags.o as string || flags.output as string;
      if (outFile) {
        const { writeFileSync } = await import('fs');
        writeFileSync(outFile, markdown);
        console.log(`Exported PRD to ${outFile}`);
      } else {
        console.log(markdown);
      }
      break;
    }

    case 'coverage': {
      const epicId = args[0];
      if (!epicId) {
        console.error('Usage: flux prd coverage <epic-id>');
        process.exit(1);
      }

      const epic = await getEpic(epicId);
      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }

      if (!epic.prd) {
        console.error(`No PRD found for epic: ${epicId}`);
        process.exit(1);
      }

      const coverage = await getPRDCoverage(epicId);

      if (json) {
        output(coverage, true);
        return;
      }

      console.log(`${c.bold}PRD Coverage: ${epic.title}${c.reset}\n`);

      const covered = coverage.filter(c => c.covered).length;
      const total = coverage.length;
      const pct = total > 0 ? Math.round((covered / total) * 100) : 0;

      console.log(`${c.bold}${covered}/${total}${c.reset} requirements covered (${pct}%)\n`);

      coverage.forEach(cov => {
        const status = cov.covered ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
        const taskInfo = cov.taskCount > 0
          ? `${c.dim}(${cov.taskCount} task${cov.taskCount > 1 ? 's' : ''})${c.reset}`
          : `${c.dim}(no tasks)${c.reset}`;
        console.log(`${status} ${c.cyan}${cov.requirementId}${c.reset} ${cov.requirement.description} ${taskInfo}`);
        if (cov.tasks.length > 0) {
          cov.tasks.forEach(t => {
            const statusColor = t.status === 'done' ? c.green : t.status === 'in_progress' ? c.yellow : c.gray;
            console.log(`    ${statusColor}[${t.status}]${c.reset} ${t.id}: ${t.title}`);
          });
        }
      });
      break;
    }

    case 'link': {
      const taskId = args[0];
      const reqIds = args.slice(1);

      if (!taskId || reqIds.length === 0) {
        console.error('Usage: flux prd link <task-id> <req-id> [req-id...]');
        process.exit(1);
      }

      const task = await getTask(taskId);
      if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }

      const updated = await linkTaskToRequirements(taskId, reqIds);
      if (!updated) {
        console.error('Failed to link task to requirements');
        process.exit(1);
      }

      if (json) {
        output(updated, true);
      } else {
        console.log(`Linked task ${taskId} to requirements: ${reqIds.join(', ')}`);
      }
      break;
    }

    case 'phase': {
      const taskId = args[0];
      const phaseId = args[1];

      if (!taskId) {
        console.error('Usage: flux prd phase <task-id> <phase-id>');
        console.error('       flux prd phase <task-id> --clear');
        process.exit(1);
      }

      const task = await getTask(taskId);
      if (!task) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }

      const clearPhase = flags.clear === true;
      const newPhaseId = clearPhase ? undefined : phaseId;

      if (!clearPhase && !phaseId) {
        console.error('Specify a phase-id or use --clear');
        process.exit(1);
      }

      const updated = await linkTaskToPhase(taskId, newPhaseId);
      if (!updated) {
        console.error('Failed to update task phase');
        process.exit(1);
      }

      if (json) {
        output(updated, true);
      } else if (clearPhase) {
        console.log(`Cleared phase from task ${taskId}`);
      } else {
        console.log(`Set task ${taskId} to phase ${phaseId}`);
      }
      break;
    }

    case 'init': {
      const epicId = args[0];
      if (!epicId) {
        console.error('Usage: flux prd init <epic-id>');
        console.error('');
        console.error('Initialize a PRD for an epic. This will create a PRD structure');
        console.error('that can be populated via MCP tools or edited directly.');
        process.exit(1);
      }

      const epic = await getEpic(epicId);
      if (!epic) {
        console.error(`Epic not found: ${epicId}`);
        process.exit(1);
      }

      if (epic.prd) {
        console.error(`Epic already has a PRD. Use 'flux prd show ${epicId}' to view it.`);
        process.exit(1);
      }

      // Create a minimal PRD structure
      const now = new Date().toISOString();
      const prd: PRD = {
        problem: flags.problem as string || '',
        goals: [],
        requirements: [],
        approach: flags.approach as string || '',
        phases: [],
        risks: [],
        outOfScope: [],
        createdAt: now,
        updatedAt: now,
      };

      const updated = await updateEpicPRD(epicId, prd);
      if (!updated) {
        console.error('Failed to create PRD');
        process.exit(1);
      }

      if (json) {
        output(updated, true);
      } else {
        console.log(`Created PRD for epic: ${epic.title}`);
        console.log('');
        console.log('Next steps:');
        console.log(`  • Use MCP tools to populate the PRD via AI conversation`);
        console.log(`  • Run 'flux prd show ${epicId}' to view the PRD`);
        console.log(`  • Run 'flux prd coverage ${epicId}' to check requirement coverage`);
      }
      break;
    }

    default:
      console.error(`Usage: flux prd <command> [options]

Commands:
  init <epic-id>              Create a new PRD for an epic
  show <epic-id>              Display the PRD
  export <epic-id> [-o file]  Export PRD as markdown
  coverage <epic-id>          Show requirement coverage by tasks
  link <task-id> <req-ids...> Link a task to requirements
  phase <task-id> <phase-id>  Set task's phase (--clear to remove)
`);
      process.exit(1);
  }
}
