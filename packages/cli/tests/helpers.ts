import { vi, beforeEach, afterEach } from 'vitest';

// Shared mock for PRIORITY_CONFIG used across test files
export const MOCK_PRIORITY_CONFIG = {
  0: { label: 'P0', ansi: '\x1b[31m' },
  1: { label: 'P1', ansi: '\x1b[33m' },
  2: { label: 'P2', ansi: '\x1b[32m' },
};

export function captureOutput() {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '));
  console.error = (...args: unknown[]) => errors.push(args.map(String).join(' '));

  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

export function mockExit() {
  const originalExit = process.exit;
  let exitCode: number | undefined;

  process.exit = ((code?: number) => {
    exitCode = code;
    throw new Error(`process.exit(${code})`);
  }) as never;

  return {
    get code() {
      return exitCode;
    },
    restore: () => {
      process.exit = originalExit;
    },
  };
}

// Setup/teardown helpers for use in beforeEach/afterEach
let outputCapture: ReturnType<typeof captureOutput> | null = null;
let exitMock: ReturnType<typeof mockExit> | null = null;

export function setupTestEnv() {
  outputCapture = captureOutput();
  exitMock = mockExit();
  return { output: outputCapture, exit: exitMock };
}

export function teardownTestEnv() {
  outputCapture?.restore();
  exitMock?.restore();
  outputCapture = null;
  exitMock = null;
}

export function getLogs() {
  return outputCapture?.logs ?? [];
}

export function getErrors() {
  return outputCapture?.errors ?? [];
}

export function getExitCode() {
  return exitMock?.code;
}
