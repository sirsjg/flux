import { describe, expect, it } from 'vitest';
import { parseArgs } from '../src/index.js';

describe('git sync commands', () => {
  describe('parseArgs for pull/push', () => {
    it('parses pull command', () => {
      const result = parseArgs(['pull']);
      expect(result.command).toBe('pull');
    });

    it('parses push command with message', () => {
      const result = parseArgs(['push', 'update tasks']);
      expect(result.command).toBe('push');
      expect(result.subcommand).toBe('update tasks');
    });

    it('parses push command without message', () => {
      const result = parseArgs(['push']);
      expect(result.command).toBe('push');
      expect(result.subcommand).toBeUndefined();
    });
  });
});
