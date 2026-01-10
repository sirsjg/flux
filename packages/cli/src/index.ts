#!/usr/bin/env node

import { resolve, dirname } from 'path';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import {
  setStorageAdapter,
  initStore,
  type StorageAdapter,
  type Store,
} from '@flux/shared';

// Commands
import { projectCommand } from './commands/project.js';
import { epicCommand } from './commands/epic.js';
import { taskCommand } from './commands/task.js';
import { readyCommand } from './commands/ready.js';
import { showCommand } from './commands/show.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find .flux directory (walk up from cwd, or use FLUX_DIR env)
function findFluxDir(): string {
  if (process.env.FLUX_DIR) {
    return process.env.FLUX_DIR;
  }

  let dir = process.cwd();
  while (dir !== '/') {
    const fluxDir = resolve(dir, '.flux');
    if (existsSync(fluxDir)) {
      return fluxDir;
    }
    dir = dirname(dir);
  }

  // Fall back to ~/.flux
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return resolve(homeDir, '.flux');
}

// Create file-based storage adapter
function createFileAdapter(dataPath: string): StorageAdapter {
  let data: Store = { projects: [], epics: [], tasks: [] };

  return {
    get data() {
      return data;
    },
    set data(newData: Store) {
      data = newData;
    },
    read() {
      if (existsSync(dataPath)) {
        const content = readFileSync(dataPath, 'utf-8');
        data = JSON.parse(content);
      }
    },
    write() {
      const dir = dirname(dataPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(dataPath, JSON.stringify(data, null, 2));
    },
  };
}

// Initialize storage
function initStorage(): void {
  const fluxDir = findFluxDir();
  const dataPath = resolve(fluxDir, 'data.json');
  const adapter = createFileAdapter(dataPath);
  setStorageAdapter(adapter);
  initStore();
}

// Parse arguments
function parseArgs(args: string[]): { command: string; subcommand?: string; args: string[]; flags: Record<string, string | boolean> } {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return {
    command: positional[0] || 'help',
    subcommand: positional[1],
    args: positional.slice(2),
    flags,
  };
}

// Output helper
export function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  const json = parsed.flags.json === true;

  // Handle init separately (before storage init)
  if (parsed.command === 'init') {
    const fluxDir = process.env.FLUX_DIR || resolve(process.cwd(), '.flux');
    const dataPath = resolve(fluxDir, 'data.json');

    if (existsSync(dataPath)) {
      console.log('.flux already initialized');
      return;
    }

    mkdirSync(fluxDir, { recursive: true });
    writeFileSync(dataPath, JSON.stringify({ projects: [], epics: [], tasks: [] }, null, 2));
    console.log(`Initialized .flux in ${fluxDir}`);
    return;
  }

  // Initialize storage for other commands
  try {
    initStorage();
  } catch (e) {
    console.error('No .flux directory found. Run: flux init');
    process.exit(1);
  }

  // Route commands
  switch (parsed.command) {
    case 'project':
      await projectCommand(parsed.subcommand, parsed.args, parsed.flags, json);
      break;
    case 'epic':
      await epicCommand(parsed.subcommand, parsed.args, parsed.flags, json);
      break;
    case 'task':
      await taskCommand(parsed.subcommand, parsed.args, parsed.flags, json);
      break;
    case 'ready':
      // ready doesn't have a subcommand, so subcommand IS the first arg
      await readyCommand(parsed.subcommand ? [parsed.subcommand, ...parsed.args] : parsed.args, parsed.flags, json);
      break;
    case 'show':
      // show doesn't have a subcommand, so subcommand IS the task ID
      await showCommand(parsed.subcommand ? [parsed.subcommand, ...parsed.args] : parsed.args, parsed.flags, json);
      break;
    case 'help':
    default:
      console.log(`${c.bold}flux${c.reset} ${c.dim}- CLI for Flux task management${c.reset}

${c.bold}Commands:${c.reset}
  ${c.cyan}flux init${c.reset}                          Initialize .flux in current directory
  ${c.cyan}flux ready${c.reset} ${c.green}[--json]${c.reset}                Show unblocked tasks sorted by priority
  ${c.cyan}flux show${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--json]${c.reset}            Show task details with notes

  ${c.cyan}flux project list${c.reset} ${c.green}[--json]${c.reset}         List all projects
  ${c.cyan}flux project create${c.reset} ${c.yellow}<name>${c.reset}         Create a project
  ${c.cyan}flux project update${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--name] [--desc]${c.reset}
  ${c.cyan}flux project delete${c.reset} ${c.yellow}<id>${c.reset}

  ${c.cyan}flux epic list${c.reset} ${c.yellow}<project>${c.reset} ${c.green}[--json]${c.reset}  List epics in project
  ${c.cyan}flux epic create${c.reset} ${c.yellow}<project> <title>${c.reset} Create an epic
  ${c.cyan}flux epic update${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--title] [--status] [--note]${c.reset}
  ${c.cyan}flux epic delete${c.reset} ${c.yellow}<id>${c.reset}

  ${c.cyan}flux task list${c.reset} ${c.yellow}<project>${c.reset} ${c.green}[--json] [--epic] [--status]${c.reset}
  ${c.cyan}flux task create${c.reset} ${c.yellow}<project> <title>${c.reset} ${c.green}[-P 0|1|2] [-e epic]${c.reset}
  ${c.cyan}flux task update${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--title] [--status] [--note] [--epic]${c.reset}
  ${c.cyan}flux task done${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--note]${c.reset}       Mark task done
  ${c.cyan}flux task start${c.reset} ${c.yellow}<id>${c.reset}               Mark task in_progress

${c.bold}Flags:${c.reset}
  ${c.green}--json${c.reset}                             Output as JSON
  ${c.green}-P, --priority${c.reset}                     Priority (0=P0, 1=P1, 2=P2)
  ${c.green}-e, --epic${c.reset}                         Epic ID
`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
