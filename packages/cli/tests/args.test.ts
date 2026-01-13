import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/index.js';

describe('parseArgs', () => {
  it('extracts command', () => {
    const result = parseArgs(['project']);
    expect(result.command).toBe('project');
  });

  it('extracts command and subcommand', () => {
    const result = parseArgs(['project', 'list']);
    expect(result.command).toBe('project');
    expect(result.subcommand).toBe('list');
  });

  it('extracts positional args after subcommand', () => {
    const result = parseArgs(['task', 'create', 'proj-1', 'My Task']);
    expect(result.command).toBe('task');
    expect(result.subcommand).toBe('create');
    expect(result.args).toEqual(['proj-1', 'My Task']);
  });

  it('handles --flag with value', () => {
    const result = parseArgs(['task', 'update', 'task-1', '--title', 'New Title']);
    expect(result.flags.title).toBe('New Title');
  });

  it('handles --flag as boolean when no value', () => {
    const result = parseArgs(['project', 'list', '--json']);
    expect(result.flags.json).toBe(true);
  });

  it('handles -f shorthand with value', () => {
    const result = parseArgs(['task', 'create', 'proj-1', 'Title', '-P', '0']);
    expect(result.flags.P).toBe('0');
  });

  it('handles -f shorthand as boolean', () => {
    const result = parseArgs(['ready', '-j']);
    expect(result.flags.j).toBe(true);
  });

  it('handles multiple flags', () => {
    const result = parseArgs(['task', 'list', 'proj-1', '--epic', 'epic-1', '--status', 'todo', '--json']);
    expect(result.flags.epic).toBe('epic-1');
    expect(result.flags.status).toBe('todo');
    expect(result.flags.json).toBe(true);
  });

  it('defaults to help command when no args', () => {
    const result = parseArgs([]);
    expect(result.command).toBe('help');
  });

  it('handles flags after positional args', () => {
    const result = parseArgs(['project', 'list', '--json']);
    expect(result.flags.json).toBe(true);
    expect(result.command).toBe('project');
    expect(result.subcommand).toBe('list');
  });
});
