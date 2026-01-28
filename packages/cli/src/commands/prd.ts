import {
  getProject,
  getProjectPRD,
  updateProjectPRD,
  getPRDCoverage,
  linkTaskToRequirements,
  linkTaskToPhase,
  getTask,
  getTasks,
  getProjectForPRDGeneration,
  setTaskVerifyResult,
} from '../client.js';
import { output } from '../index.js';
import type { PRD, Requirement, Phase } from '@flux/shared';
import { execSync } from 'child_process';

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
  const typeLabel = req.type === 'functional' ? 'F' : req.type === 'non-functional' ? 'NF' : 'C';
  return `${indent}${c.cyan}${req.id}${c.reset} [${typeLabel}] ${req.description}${req.acceptance ? `\n${indent}  ${c.dim}Acceptance: ${req.acceptance}${c.reset}` : ''}`;
}

// Export PRD as markdown
function prdToMarkdown(project: { name: string }, prd: PRD): string {
  const lines: string[] = [];
  lines.push(`# PRD: ${project.name}`);
  lines.push('');

  if (prd.sourceUrl) {
    lines.push(`**Source:** [${prd.sourceUrl}](${prd.sourceUrl})`);
    lines.push('');
  }

  if (prd.summary) {
    lines.push('## Executive Summary');
    lines.push(prd.summary);
    lines.push('');
  }

  lines.push('## Problem Statement');
  lines.push(prd.problem);
  lines.push('');

  lines.push('## Goals');
  prd.goals.forEach(g => lines.push(`- ${g}`));
  lines.push('');

  if (prd.successCriteria?.length) {
    lines.push('## Success Criteria');
    prd.successCriteria.forEach(s => lines.push(`- ${s}`));
    lines.push('');
  }

  if (prd.businessRules?.length) {
    lines.push('## Business Rules');
    lines.push('');
    prd.businessRules.forEach(br => {
      const scope = br.scope ? ` _(${br.scope})_` : '';
      lines.push(`### ${br.id}${scope}`);
      lines.push(br.description);
      if (br.notes) {
        lines.push(`> ${br.notes}`);
      }
      lines.push('');
    });
  }

  lines.push('## Requirements');
  lines.push('');

  prd.requirements.forEach(r => {
    lines.push(`- **${r.id}** [${r.type}]: ${r.description}`);
    if (r.acceptance) lines.push(`  - _Acceptance_: ${r.acceptance}`);
  });
  lines.push('');

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

  if (prd.dependencies?.length) {
    lines.push('## Dependencies');
    lines.push('');
    lines.push('| ID | Description | Owner | Status |');
    lines.push('|----|-------------|-------|--------|');
    prd.dependencies.forEach(d => {
      lines.push(`| ${d.id} | ${d.description} | ${d.owner || '-'} | ${d.status || 'unknown'} |`);
    });
    lines.push('');
  }

  if (prd.risks.length) {
    lines.push('## Risks');
    prd.risks.forEach(r => lines.push(`- ${r}`));
    lines.push('');
  }

  if (prd.openQuestions?.length) {
    lines.push('## Open Questions');
    lines.push('');
    prd.openQuestions.forEach(q => {
      const status = q.resolved ? '✓' : '?';
      const owner = q.owner ? ` _(${q.owner})_` : '';
      lines.push(`### ${status} ${q.id}${owner}`);
      lines.push(q.question);
      if (q.context) {
        lines.push(`> Context: ${q.context}`);
      }
      if (q.resolved) {
        lines.push(`**Resolved:** ${q.resolved}`);
      }
      lines.push('');
    });
  }

  if (prd.outOfScope.length) {
    lines.push('## Out of Scope');
    prd.outOfScope.forEach(o => lines.push(`- ${o}`));
    lines.push('');
  }

  if (prd.terminology?.length) {
    lines.push('## Terminology');
    lines.push('');
    lines.push('| Term | Definition |');
    lines.push('|------|------------|');
    prd.terminology.forEach(t => {
      lines.push(`| **${t.term}** | ${t.definition} |`);
    });
    lines.push('');
  }

  if (prd.approvals?.length) {
    lines.push('## Approvals');
    lines.push('');
    lines.push('| Role | Name | Status | Date |');
    lines.push('|------|------|--------|------|');
    prd.approvals.forEach(a => {
      lines.push(`| ${a.role} | ${a.name || '-'} | ${a.status} | ${a.date || '-'} |`);
    });
    lines.push('');
  }

  if (prd.notes) {
    lines.push('## Session Notes');
    lines.push('');
    lines.push(prd.notes);
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
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd show <project-id>');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      const prd = await getProjectPRD(projectId);
      if (!prd) {
        console.error(`No PRD found for project: ${projectId}`);
        console.error(`Create one with: flux prd init ${projectId}`);
        process.exit(1);
      }

      if (json) {
        output({ project, prd }, true);
        return;
      }

      console.log(`${c.bold}PRD: ${project.name}${c.reset}`);
      if (prd.sourceUrl) {
        console.log(`${c.dim}Source: ${prd.sourceUrl}${c.reset}`);
      }
      console.log('');

      if (prd.summary) {
        console.log(`${c.bold}Summary${c.reset}`);
        console.log(`  ${prd.summary}\n`);
      }

      console.log(`${c.bold}Problem${c.reset}`);
      console.log(`  ${prd.problem}\n`);

      console.log(`${c.bold}Goals${c.reset}`);
      prd.goals.forEach(g => console.log(`  • ${g}`));
      console.log('');

      if (prd.successCriteria?.length) {
        console.log(`${c.bold}Success Criteria${c.reset}`);
        prd.successCriteria.forEach(s => console.log(`  ${c.green}✓${c.reset} ${s}`));
        console.log('');
      }

      if (prd.businessRules?.length) {
        console.log(`${c.bold}Business Rules${c.reset}`);
        prd.businessRules.forEach(br => {
          const scopeLabel = br.scope ? ` ${c.dim}[${br.scope}]${c.reset}` : '';
          console.log(`  ${c.cyan}${br.id}${c.reset}${scopeLabel} ${br.description}`);
          if (br.notes) {
            console.log(`    ${c.dim}${br.notes}${c.reset}`);
          }
        });
        console.log('');
      }

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

      if (prd.dependencies?.length) {
        console.log(`${c.bold}Dependencies${c.reset}`);
        prd.dependencies.forEach(d => {
          const statusColor = d.status === 'confirmed' ? c.green : d.status === 'blocked' ? c.red : c.yellow;
          const statusLabel = d.status ? ` ${statusColor}[${d.status}]${c.reset}` : '';
          const ownerLabel = d.owner ? ` ${c.dim}(${d.owner})${c.reset}` : '';
          console.log(`  ${c.cyan}${d.id}${c.reset}${statusLabel} ${d.description}${ownerLabel}`);
        });
        console.log('');
      }

      if (prd.risks.length) {
        console.log(`${c.bold}Risks${c.reset}`);
        prd.risks.forEach(r => console.log(`  ${c.yellow}⚠${c.reset} ${r}`));
        console.log('');
      }

      if (prd.openQuestions?.length) {
        console.log(`${c.bold}Open Questions${c.reset}`);
        prd.openQuestions.forEach(q => {
          const resolved = q.resolved;
          const icon = resolved ? `${c.green}✓${c.reset}` : `${c.yellow}?${c.reset}`;
          const ownerLabel = q.owner ? ` ${c.dim}(${q.owner})${c.reset}` : '';
          console.log(`  ${icon} ${c.cyan}${q.id}${c.reset} ${q.question}${ownerLabel}`);
          if (q.context) {
            console.log(`    ${c.dim}Context: ${q.context}${c.reset}`);
          }
          if (resolved) {
            console.log(`    ${c.green}Resolved: ${resolved}${c.reset}`);
          }
        });
        console.log('');
      }

      if (prd.outOfScope.length) {
        console.log(`${c.bold}Out of Scope${c.reset}`);
        prd.outOfScope.forEach(o => console.log(`  ${c.dim}✗${c.reset} ${o}`));
        console.log('');
      }

      if (prd.terminology?.length) {
        console.log(`${c.bold}Terminology${c.reset}`);
        prd.terminology.forEach(t => {
          console.log(`  ${c.bold}${t.term}${c.reset}: ${t.definition}`);
        });
        console.log('');
      }

      if (prd.approvals?.length) {
        console.log(`${c.bold}Approvals${c.reset}`);
        prd.approvals.forEach(a => {
          const statusColor = a.status === 'approved' ? c.green : a.status === 'rejected' ? c.red : c.yellow;
          const icon = a.status === 'approved' ? '✓' : a.status === 'rejected' ? '✗' : '○';
          const nameLabel = a.name ? ` (${a.name})` : '';
          console.log(`  ${statusColor}${icon}${c.reset} ${a.role}${nameLabel} ${statusColor}${a.status}${c.reset}`);
        });
        console.log('');
      }

      if (prd.notes) {
        console.log(`${c.bold}Session Notes${c.reset}`);
        for (const line of prd.notes.split('\n')) {
          const match = line.match(/^\[(\d{4}-\d{2}-\d{2})\] (.*)$/);
          if (match) {
            console.log(`  ${c.dim}${match[1]}${c.reset} ${match[2]}`);
          } else {
            console.log(`  ${line}`);
          }
        }
      }
      break;
    }

    case 'export': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd export <project-id> [-o file.md]');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      const prd = await getProjectPRD(projectId);
      if (!prd) {
        console.error(`No PRD found for project: ${projectId}`);
        process.exit(1);
      }

      const markdown = prdToMarkdown(project, prd);

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
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd coverage <project-id>');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      if (!project.prd) {
        console.error(`No PRD found for project: ${projectId}`);
        process.exit(1);
      }

      const coverage = await getPRDCoverage(projectId);

      if (json) {
        output(coverage, true);
        return;
      }

      console.log(`${c.bold}PRD Coverage: ${project.name}${c.reset}\n`);

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
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd init <project-id>');
        console.error('');
        console.error('Initialize a PRD for a project. This will create a PRD structure');
        console.error('that can be populated via MCP tools or edited directly.');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      if (project.prd) {
        console.error(`Project already has a PRD. Use 'flux prd show ${projectId}' to view it.`);
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

      const updated = await updateProjectPRD(projectId, prd);
      if (!updated) {
        console.error('Failed to create PRD');
        process.exit(1);
      }

      if (json) {
        output(updated, true);
      } else {
        console.log(`Created PRD for project: ${project.name}`);
        console.log('');
        console.log('Next steps:');
        console.log(`  • Use MCP tools to populate the PRD via AI conversation`);
        console.log(`  • Run 'flux prd show ${projectId}' to view the PRD`);
        console.log(`  • Run 'flux prd coverage ${projectId}' to check requirement coverage`);
      }
      break;
    }

    case 'generate': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd generate <project-id>');
        console.error('');
        console.error('Generate a PRD from existing tasks in a project.');
        console.error('Outputs task context for AI to create a PRD.');
        process.exit(1);
      }

      const context = await getProjectForPRDGeneration(projectId);
      if (!context) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      if (context.tasks.length === 0) {
        console.error(`Project has no tasks. Add tasks first, then generate PRD.`);
        process.exit(1);
      }

      if (json) {
        output(context, true);
        return;
      }

      console.log(`${c.bold}Project: ${context.project.name}${c.reset}`);
      if (context.project.description) {
        console.log(`${c.dim}Description: ${context.project.description}${c.reset}`);
      }
      console.log('');
      console.log(`${c.bold}Tasks (${context.tasks.length}):${c.reset}`);

      context.tasks.forEach((t, i) => {
        console.log(`\n${c.cyan}${i + 1}. ${t.title}${c.reset} [${t.status}]`);
        if (t.acceptance_criteria?.length) {
          console.log(`   ${c.green}Acceptance:${c.reset}`);
          t.acceptance_criteria.forEach(ac => console.log(`     • ${ac}`));
        }
        if (t.guardrails?.length) {
          console.log(`   ${c.yellow}Guardrails:${c.reset}`);
          t.guardrails.forEach(g => console.log(`     ${g.number}: ${g.text}`));
        }
        if (t.depends_on.length) {
          console.log(`   ${c.dim}Depends on: ${t.depends_on.join(', ')}${c.reset}`);
        }
      });

      console.log('');
      console.log(`${c.bold}Next steps:${c.reset}`);
      console.log(`  Use the MCP tool 'get_project_for_prd_generation' to get this data,`);
      console.log(`  then use 'update_prd' to create the PRD based on these tasks.`);
      console.log(`  Finally use 'link_task_to_requirements' to link each task.`);
      break;
    }

    case 'verify': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd verify <project-id>');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      // Get all tasks in this project
      const allTasks = await getTasks(projectId);
      const projectTasks = allTasks.filter(t => !t.archived);

      if (projectTasks.length === 0) {
        console.log('No tasks in this project');
        break;
      }

      const results: { id: string; title: string; passed: boolean | null; output?: string }[] = [];

      for (const task of projectTasks) {
        if (!task.verify) {
          results.push({ id: task.id, title: task.title, passed: null });
          continue;
        }

        try {
          const cmdOutput = execSync(task.verify, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 60000,
          });
          await setTaskVerifyResult(task.id, true, cmdOutput.trim());
          results.push({ id: task.id, title: task.title, passed: true, output: cmdOutput.trim() });
        } catch (err) {
          const error = err as { stdout?: string; stderr?: string; message?: string };
          const errorOutput = error.stderr || error.stdout || error.message || 'Command failed';
          await setTaskVerifyResult(task.id, false, errorOutput.trim());
          results.push({ id: task.id, title: task.title, passed: false, output: errorOutput.trim() });
        }
      }

      if (json) {
        output(results, true);
        break;
      }

      // Display results
      const passCount = results.filter(r => r.passed === true).length;
      const failCount = results.filter(r => r.passed === false).length;
      const noVerify = results.filter(r => r.passed === null).length;

      console.log(`${c.bold}Verification: ${project.name}${c.reset}\n`);

      for (const r of results) {
        if (r.passed === true) {
          console.log(`${c.green}✓${c.reset} ${r.id}: ${r.title}`);
        } else if (r.passed === false) {
          console.log(`${c.red}✗${c.reset} ${r.id}: ${r.title}`);
          if (r.output) {
            console.log(`  ${c.dim}${r.output.split('\n')[0]}${c.reset}`);
          }
        } else {
          console.log(`${c.dim}○${c.reset} ${r.id}: ${r.title} ${c.dim}(no verify command)${c.reset}`);
        }
      }

      console.log('');
      console.log(`Coverage: ${passCount + failCount}/${projectTasks.length} tasks have verify commands`);
      if (passCount + failCount > 0) {
        console.log(`Results: ${passCount} passed, ${failCount} failed`);
      }
      break;
    }

    case 'notes': {
      const projectId = args[0];
      if (!projectId) {
        console.error('Usage: flux prd notes <project-id>           # Show notes');
        console.error('       flux prd notes <project-id> -a "note" # Add note');
        process.exit(1);
      }

      const project = await getProject(projectId);
      if (!project) {
        console.error(`Project not found: ${projectId}`);
        process.exit(1);
      }

      const prd = await getProjectPRD(projectId);
      if (!prd) {
        console.error(`No PRD found for project: ${projectId}`);
        process.exit(1);
      }

      const addNote = flags.a as string || flags.add as string;
      if (addNote) {
        const timestamp = new Date().toISOString().split('T')[0];
        const newNote = `[${timestamp}] ${addNote}`;
        prd.notes = prd.notes ? `${prd.notes}\n${newNote}` : newNote;
        prd.updatedAt = new Date().toISOString();

        const updated = await updateProjectPRD(projectId, prd);
        if (!updated) {
          console.error('Failed to update PRD');
          process.exit(1);
        }

        if (json) {
          output({ note: newNote, notes: prd.notes }, true);
        } else {
          console.log(`Added note: ${newNote}`);
        }
        break;
      }

      // Display notes
      if (json) {
        output({ notes: prd.notes || null }, true);
        break;
      }

      if (!prd.notes) {
        console.log(`${c.dim}No session notes for this PRD${c.reset}`);
        console.log(`Add one with: flux prd notes ${projectId} -a "Your note"`);
        break;
      }

      console.log(`${c.bold}Session Notes: ${project.name}${c.reset}\n`);
      for (const line of prd.notes.split('\n')) {
        const match = line.match(/^\[(\d{4}-\d{2}-\d{2})\] (.*)$/);
        if (match) {
          console.log(`${c.dim}${match[1]}${c.reset} ${match[2]}`);
        } else {
          console.log(line);
        }
      }
      break;
    }

    default:
      console.error(`Usage: flux prd <command> [options]

Commands:
  init <project-id>              Create a new PRD for a project
  generate <project-id>          Generate PRD from existing tasks
  show <project-id>              Display the PRD
  export <project-id> [-o file]  Export PRD as markdown
  coverage <project-id>          Show requirement coverage by tasks
  verify <project-id>            Run verify commands for all tasks
  notes <project-id>             Show session notes
  notes <project-id> -a "note"   Add a session note
  link <task-id> <req-ids...>    Link a task to requirements
  phase <task-id> <phase-id>     Set task's phase (--clear to remove)
`);
      process.exit(1);
  }
}
