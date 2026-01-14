import { getReadyTasks, getProjects } from '../client.js';
import { output } from '../index.js';

// Minimal workflow reminder for MCP/hook context
const MCP_REMINDER = `## Flux
Track work as tasks. Close when done. Use \`flux ready\` to see unblocked tasks.`;

// Full workflow instructions for CLI mode
const FULL_INSTRUCTIONS = `## Flux Task Management

**Rules:**
- All work MUST belong to exactly one project_id
- Track all work as tasks; update status as you progress
- Close tasks immediately when complete

**Commands:**
- \`flux ready\` - Show unblocked tasks by priority
- \`flux task create [project] <title> -P 0|1|2\` - Create task
- \`flux task done <id>\` - Mark complete
- \`flux task update <id> --note "..."\` - Add comment

**If context is lost:** Run \`flux ready\` to see current tasks.`;

export async function primeCommand(
  args: string[],
  flags: Record<string, string | boolean>,
  json: boolean,
  defaultProject?: string
): Promise<void> {
  const mcp = flags.mcp === true;
  const full = flags.full === true;

  // Determine mode: --mcp forces minimal, --full forces full, else auto-detect
  const isMcpMode = mcp || (!full && process.env.MCP_SERVER === 'true');

  if (json) {
    const projects = await getProjects();
    const tasks = await getReadyTasks();
    output({
      mode: isMcpMode ? 'mcp' : 'cli',
      project: defaultProject,
      readyCount: tasks.length,
      projects: projects.map(p => ({ id: p.id, name: p.name })),
    }, true);
    return;
  }

  // Output instructions
  console.log(isMcpMode ? MCP_REMINDER : FULL_INSTRUCTIONS);

  // Show context if available
  if (defaultProject) {
    console.log(`\nProject: ${defaultProject}`);
  }

  // Show ready task count
  try {
    const tasks = await getReadyTasks();
    if (tasks.length > 0) {
      const p0 = tasks.filter(t => t.priority === 0).length;
      const p1 = tasks.filter(t => t.priority === 1).length;
      const p2 = tasks.filter(t => (t.priority ?? 2) === 2).length;
      const parts = [];
      if (p0) parts.push(`${p0} P0`);
      if (p1) parts.push(`${p1} P1`);
      if (p2) parts.push(`${p2} P2`);
      console.log(`Ready: ${parts.join(', ')}`);
    }
  } catch {
    // Ignore errors - prime should always succeed for hooks
  }
}
