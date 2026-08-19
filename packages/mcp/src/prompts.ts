import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const userMessage = (text: string) => ({
  messages: [
    {
      role: 'user' as const,
      content: { type: 'text' as const, text },
    },
  ],
});

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'whats_next',
    {
      title: "What's Next",
      description: 'Find the next Flux task(s) to work on, in priority order',
      argsSchema: {
        project_id: z.string().optional().describe('Optional: limit to a single project ID'),
      },
    },
    ({ project_id }) =>
      userMessage(
        [
          project_id
            ? `Use the list_ready_tasks tool with project_id "${project_id}" to find actionable work.`
            : 'Use the list_projects tool to see all projects, then list_ready_tasks to find actionable work.',
          '',
          'For the top-priority ready task:',
          '1. Show its title, priority, acceptance criteria, and guardrails.',
          '2. Summarize any comments (they carry context from previous sessions).',
          '3. Recommend whether to start it now, and what the first step would be.',
          '',
          'If nothing is ready, list what is blocked and what would unblock it.',
        ].join('\n')
      )
  );

  server.registerPrompt(
    'project_status',
    {
      title: 'Project Status',
      description: 'Summarize the state of a Flux project board',
      argsSchema: {
        project_id: z.string().describe('Project ID to summarize'),
      },
    },
    ({ project_id }) =>
      userMessage(
        [
          `Summarize the current state of Flux project "${project_id}".`,
          '',
          `1. Use list_epics and list_tasks with project_id "${project_id}".`,
          '2. Report progress per status column (planning / todo / in_progress / done).',
          '3. Call out blocked tasks and their blockers (dependencies or blocked_reason).',
          '4. Flag anything stale: tasks in_progress with no recent comments, or epics with all tasks done.',
          '5. End with a short recommendation of the next 1-3 actions.',
        ].join('\n')
      )
  );
}
