#!/usr/bin/env bun

import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import { setStorageAdapter, initStore } from '@flux/shared';
import { createAdapter } from '@flux/shared/adapters';
import { type FluxConfig, findFluxDir, readConfig, writeConfig } from './config.js';

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  cyanBright: '\x1b[96m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};

// Interactive prompt helper
function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Check if running interactively
function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}

// Commands
import { projectCommand } from './commands/project.js';
import { epicCommand } from './commands/epic.js';
import { taskCommand } from './commands/task.js';
import { readyCommand } from './commands/ready.js';
import { showCommand } from './commands/show.js';
import { serveCommand } from './commands/serve.js';
import { initClient, exportAll, importAll } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Flux instructions for AGENTS.md/CLAUDE.md
const FLUX_INSTRUCTIONS = `<!-- FLUX:START -->
## Flux Task Management

You have access to Flux for task management via MCP or CLI.

**Rules:**
- All work MUST belong to exactly one project_id
- Do NOT guess or invent a project_id
- Track all work as tasks; update status as you progress
- Close tasks immediately when complete

**Startup:**
1. List projects (\`flux project list\`)
2. Select or create ONE project
3. Confirm active project_id before any work

**If context is lost:** Re-list projects/tasks. Ask user if ambiguous.
<!-- FLUX:END -->`;

// Update AGENTS.md or CLAUDE.md with flux instructions
function updateAgentInstructions(): string | null {
  const cwd = process.cwd();
  const candidates = ['AGENTS.md', 'CLAUDE.md'];

  let targetFile: string | null = null;
  for (const name of candidates) {
    const path = resolve(cwd, name);
    if (existsSync(path)) {
      targetFile = path;
      break;
    }
  }

  // Default to AGENTS.md if none exist
  if (!targetFile) {
    targetFile = resolve(cwd, 'AGENTS.md');
  }

  let content = existsSync(targetFile) ? readFileSync(targetFile, 'utf-8') : '';

  const startMarker = '<!-- FLUX:START -->';
  const endMarker = '<!-- FLUX:END -->';
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    // Replace existing section
    content = content.slice(0, startIdx) + FLUX_INSTRUCTIONS + content.slice(endIdx + endMarker.length);
  } else {
    // Append section
    content = content.trimEnd() + '\n\n' + FLUX_INSTRUCTIONS + '\n';
  }

  writeFileSync(targetFile, content.trimStart());
  return targetFile;
}

// Find git root directory
function findGitRoot(): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

// Ensure worktree exists for flux-data branch
function ensureWorktree(gitRoot: string): string {
  const worktreePath = resolve(gitRoot, '.git', 'flux-worktree');

  if (existsSync(worktreePath)) {
    return worktreePath;
  }

  // Check if flux-data branch exists locally or remotely
  const branchExists = ['flux-data', 'origin/flux-data'].some(ref => {
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: 'pipe', cwd: gitRoot });
      return true;
    } catch { return false; }
  });

  if (!branchExists) {
    // Create orphan branch
    execSync('git checkout --orphan flux-data', { stdio: 'pipe', cwd: gitRoot });
    try {
      execSync('git rm -rf .', { stdio: 'pipe', cwd: gitRoot });
    } catch { /* ignore - may fail if nothing to remove */ }
    execSync('git commit --allow-empty -m "init flux-data"', { stdio: 'pipe', cwd: gitRoot });
    execSync('git checkout -', { stdio: 'pipe', cwd: gitRoot });
  }

  // Create worktree
  execSync(`git worktree add "${worktreePath}" flux-data`, { stdio: 'pipe', cwd: gitRoot });
  return worktreePath;
}

// Initialize storage (file or server mode)
function initStorage(): { mode: 'file' | 'server'; serverUrl?: string } {
  const fluxDir = findFluxDir();
  const config = readConfig(fluxDir);

  if (config.server) {
    // Server mode - initialize client with server URL
    initClient(config.server);
    return { mode: 'server', serverUrl: config.server };
  }

  // File mode - use local storage + initialize client without server
  // Priority: FLUX_DATA env var > config.dataFile > default data.json
  const dataPath = process.env.FLUX_DATA || (config.dataFile ? resolve(fluxDir, config.dataFile) : resolve(fluxDir, 'data.json'));
  const adapter = createAdapter(dataPath);
  setStorageAdapter(adapter);
  initStore();
  initClient(); // No server = local mode
  return { mode: 'file' };
}

// Parse arguments
export function parseArgs(args: string[]): { command: string; subcommand?: string; args: string[]; flags: Record<string, string | boolean> } {
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
  console.log(json ? JSON.stringify(data, null, 2) : data);
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  const json = parsed.flags.json === true;

  // Handle init separately (before storage init)
  if (parsed.command === 'init') {
    const fluxDir = process.env.FLUX_DIR || resolve(process.cwd(), '.flux');
    const useSqlite = parsed.flags.sqlite === true;
    const dataFileName = useSqlite ? 'data.sqlite' : 'data.json';
    const dataPath = resolve(fluxDir, dataFileName);
    const configPath = resolve(fluxDir, 'config.json');
    const isNew = !existsSync(resolve(fluxDir, 'data.json')) && !existsSync(resolve(fluxDir, 'data.sqlite'));

    mkdirSync(fluxDir, { recursive: true });

    // Determine mode: --server flag, interactive prompt, or default to git
    let serverUrl: string | undefined = parsed.flags.server as string | undefined;
    const useGit = parsed.flags.git === true;

    if (!serverUrl && !useGit && isNew && isInteractive()) {
      // Interactive mode for new init
      console.log(`${c.bold}Flux Setup${c.reset}\n`);
      console.log('Choose how to sync tasks:\n');
      console.log(`  ${c.cyan}1${c.reset}) ${c.bold}Git branches${c.reset} (default) - sync via flux-data branch`);
      console.log(`  ${c.cyan}2${c.reset}) ${c.bold}Server${c.reset} - connect to a Flux server\n`);

      const choice = await prompt('Choice [1]: ');

      if (choice === '2') {
        serverUrl = await prompt('Server URL: ');
        if (!serverUrl) {
          console.error('Server URL required');
          process.exit(1);
        }
      }
    }

    // Write config
    const config: FluxConfig = {};
    if (serverUrl) config.server = serverUrl;
    if (useSqlite) config.dataFile = 'data.sqlite';
    writeConfig(fluxDir, config);

    // Create data file for git mode (server mode doesn't need it)
    if (!serverUrl && !existsSync(dataPath)) {
      if (useSqlite) {
        // SQLite adapter creates file automatically on first use
        const adapter = createAdapter(dataPath);
        setStorageAdapter(adapter);
        initStore();
      } else {
        writeFileSync(dataPath, JSON.stringify({ projects: [], epics: [], tasks: [] }, null, 2));
      }
    }

    if (isNew) {
      console.log(`Initialized .flux in ${fluxDir}`);
      if (serverUrl) {
        console.log(`Mode: server (${serverUrl})`);
      } else {
        console.log(`Mode: git (${useSqlite ? 'sqlite' : 'json'})`);
      }
    } else {
      console.log('.flux already initialized');
      if (serverUrl) {
        console.log(`Updated server: ${serverUrl}`);
      }
    }

    // Update agent instructions (interactive or skip with --no-agents)
    if (parsed.flags['no-agents'] !== true) {
      let updateAgents = true;
      if (isNew && isInteractive()) {
        const answer = await prompt('\nUpdate AGENTS.md with Flux instructions? [Y/n]: ');
        updateAgents = answer.toLowerCase() !== 'n';
      }
      if (updateAgents) {
        const agentFile = updateAgentInstructions();
        console.log(`Updated ${agentFile}`);
      }
    }
    return;
  }

  // Handle git sync commands (before storage init)
  if (parsed.command === 'pull' || parsed.command === 'push') {
    const fluxDir = findFluxDir();
    const config = readConfig(fluxDir);
    if (config.server) {
      console.error('pull/push not available in server mode - data syncs automatically');
      process.exit(1);
    }
    const gitRoot = findGitRoot();
    if (!gitRoot) {
      console.error('Not in a git repository');
      process.exit(1);
    }

    const dataPath = resolve(fluxDir, 'data.json');

    if (parsed.command === 'pull') {
      try {
        const worktree = ensureWorktree(gitRoot);
        const worktreeData = resolve(worktree, '.flux', 'data.json');

        execSync('git fetch origin flux-data', { stdio: 'pipe', cwd: worktree });
        execSync('git reset --hard origin/flux-data', { stdio: 'pipe', cwd: worktree });

        if (existsSync(worktreeData)) {
          mkdirSync(fluxDir, { recursive: true });
          writeFileSync(dataPath, readFileSync(worktreeData, 'utf-8'));
          console.log('Pulled latest tasks from flux-data branch');
        } else {
          console.log('No .flux/data.json in flux-data branch yet');
        }
      } catch (e: any) {
        console.error('Failed to pull:', e.message);
        process.exit(1);
      }
    } else {
      const msg = parsed.subcommand || 'update tasks';
      if (!existsSync(dataPath)) {
        console.error('No .flux/data.json found. Run: flux init');
        process.exit(1);
      }

      try {
        const worktree = ensureWorktree(gitRoot);
        const worktreeFlux = resolve(worktree, '.flux');
        const worktreeData = resolve(worktreeFlux, 'data.json');

        mkdirSync(worktreeFlux, { recursive: true });
        writeFileSync(worktreeData, readFileSync(dataPath, 'utf-8'));

        execSync('git add .flux/data.json', { stdio: 'pipe', cwd: worktree });
        try {
          execSync(`git commit -m "flux: ${msg}"`, { stdio: 'pipe', cwd: worktree });
          execSync('git push origin flux-data', { stdio: 'pipe', cwd: worktree });
          console.log(`Pushed tasks to flux-data branch: "${msg}"`);
        } catch {
          console.log('No changes to push');
        }
      } catch (e: any) {
        console.error('Failed to push:', e.message);
        process.exit(1);
      }
    }
    return;
  }

  // Serve handles its own storage initialization
  if (parsed.command === 'serve') {
    await serveCommand(parsed.args, parsed.flags);
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
    case 'export': {
      const data = await exportAll();
      const output = JSON.stringify(data, null, 2);
      const outFile = parsed.flags.o as string || parsed.flags.output as string;
      if (outFile) {
        writeFileSync(outFile, output);
        console.log(`Exported to ${outFile}`);
      } else {
        console.log(output);
      }
      break;
    }
    case 'import': {
      const file = parsed.subcommand;
      if (!file) {
        console.error('Usage: flux import <file> [--merge]');
        process.exit(1);
      }
      let content: string;
      if (file === '-') {
        // Read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf-8');
      } else {
        if (!existsSync(file)) {
          console.error(`File not found: ${file}`);
          process.exit(1);
        }
        content = readFileSync(file, 'utf-8');
      }
      const data = JSON.parse(content);
      const merge = parsed.flags.merge === true;
      await importAll(data, merge);
      const action = merge ? 'Merged' : 'Imported';
      console.log(`${action} ${data.projects?.length || 0} projects, ${data.epics?.length || 0} epics, ${data.tasks?.length || 0} tasks`);
      break;
    }
    case 'help':
    default: {
      const showLogo = parsed.flags['no-logo'] !== true;
      if (showLogo) {
        console.log(`                                   ⠀⠀⠀⠀⠀⠐⠠⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠄⠀⠀⠀⠀
                                   ⠀⠀⠀⡁⣾⠷⠄⠀⠈⠈⠀⠀⠀⠀⠀⠉⠀⠁⠀⣤⣾⡇⢰⠀⠀⠀⠀
                                   ⠀⠀⠀⠁⢫⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢺⡇⠈⠀⠀⠀⠀
                                   ⠀⠀⠀⠎⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⡟⠀⡅⠀⠀⠀⠀
${c.cyan}███████╗██╗     ██╗   ██╗██╗  ██╗${c.reset}  ⠀⠀⠈⢂⠁⠀⢀⣤⢄⠀⠀⠀⠀⢀⣀⡀⠀⠀⠀⠀⠱⣀⣰⠀⠀⠀⠀
${c.cyan}██╔════╝██║     ██║   ██║╚██╗██╔╝${c.reset}  ⠀⠀⢠⠂⠀⠀⠸⣻⡾⠀⠀⠀⠀⣷⣿⢿⠀⠀⠀⠀⠀⠱⡀⠀⠀⠀⠀
${c.cyan}█████╗  ██║     ██║   ██║ ╚███╔╝${c.reset}   ⠀⠀⠀⠧⠀⢀⠀⠀⠀⠐⠖⠀⠀⠈⠋⠈⢀⠀⠀⢠⣾⣿⠃⠀⠀⠀⠀
${c.cyan}██╔══╝  ██║     ██║   ██║ ██╔██╗${c.reset}   ⠀⠀⠀⠀⢟⡦⠿⢿⣤⣀⠀⠀⢀⣠⣦⣶⡟⣀⣀⣼⣿⠇⠀⠀⠀⠀⠀
${c.cyan}██║     ███████╗╚██████╔╝██╔╝ ██╗${c.reset}  ⠀⠀⠀⠀⢰⣿⠶⣤⠀⠙⠟⠛⠉⣉⣭⣉⣹⣿⣿⣿⡏⠀⠀⠀⠀⠀⠀
${c.cyan}╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝${c.reset}  ⠀⠀⠀⣰⡵⢛⡁⠀⠀⠀⠀⠀⠘⠛⠿⣋⡛⠿⡿⣿⣷⡀⠀⠀⠀⠀⠀
                                   ⠀⢀⣴⢟⣴⣯⡀⠀⠀⠀⠀⠀⣴⣿⣦⠀⡙⢷⣌⡛⠿⣷⣄⠀⠀⠀⠀
                                   ⢠⣾⣏⣾⣿⣿⣷⠀⠀⠀⠀⠀⢻⣿⣿⣧⡹⣿⣿⣫⡛⢿⣿⣿⣶⣄⡀
                                   ⢣⡻⢿⠛⢿⣿⣿⣷⣦⣤⣤⣶⣿⣿⣿⣿⣷⣿⣿⣿⣿⣷⣽⡿⣿⡿⡼
                                   ⠀⠉⠛⠀⠀⠈⠙⢻⣿⣿⣿⣿⢿⣿⣿⣿⣿⣿⠟⠿⣟⣻⣟⡻⠤⠊⠀
                                   ⠀⠀⠀⠀⠀⠀⠀⠀⠹⠿⠟⠁⠀⠙⢿⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀
`);
      }
      console.log(`${c.cyan}${c.bold}flux${c.reset} ${c.dim}- CLI for Flux task management${c.reset}

${c.bold}Commands:${c.reset}
  ${c.cyan}flux init${c.reset} ${c.green}[--server URL] [--sqlite] [--git]${c.reset}  Initialize .flux
  ${c.cyan}flux ready${c.reset} ${c.green}[--json]${c.reset}                Show unblocked tasks sorted by priority
  ${c.cyan}flux show${c.reset} ${c.yellow}<id>${c.reset} ${c.green}[--json]${c.reset}            Show task details with comments

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

${c.bold}Data:${c.reset}
  ${c.cyan}flux export${c.reset} ${c.green}[-o file]${c.reset}              Export all data to JSON
  ${c.cyan}flux import${c.reset} ${c.yellow}<file>${c.reset} ${c.green}[--merge]${c.reset}      Import data from JSON (use - for stdin)

${c.bold}Sync:${c.reset} ${c.dim}(git-based team sync via flux-data branch)${c.reset}
  ${c.cyan}flux pull${c.reset}                          Pull latest tasks from flux-data branch
  ${c.cyan}flux push${c.reset} ${c.yellow}[message]${c.reset}                Push tasks to flux-data branch

${c.bold}Server:${c.reset}
  ${c.cyan}flux serve${c.reset} ${c.green}[-p port] [--data file]${c.reset}  Start web UI (port 3589 = FLUX on keypad)

${c.bold}Flags:${c.reset}
  ${c.green}--json${c.reset}                             Output as JSON
  ${c.green}-P, --priority${c.reset}                     Priority (0=P0, 1=P1, 2=P2)
  ${c.green}-e, --epic${c.reset}                         Epic ID
  ${c.green}--data${c.reset}                             Data file path (serve command)
  ${c.green}--no-logo${c.reset}                          Hide logo in help output
`);
      break;
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
