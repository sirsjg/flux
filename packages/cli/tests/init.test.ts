import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../src/index.ts');

describe('flux init gitignore', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = resolve(tmpdir(), `flux-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    execSync('git init', { cwd: testDir, stdio: 'pipe' });
    // Configure git user for commits
    execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: testDir, stdio: 'pipe' });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('creates .gitignore with .flux/ when none exists', () => {
    execSync(`bun "${CLI_PATH}" init --force --no-agents`, { cwd: testDir, stdio: 'pipe' });
    const content = readFileSync(resolve(testDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.flux/');
  });

  it('appends .flux/ to existing .gitignore', () => {
    writeFileSync(resolve(testDir, '.gitignore'), 'node_modules/\n');
    execSync(`bun "${CLI_PATH}" init --force --no-agents`, { cwd: testDir, stdio: 'pipe' });
    const content = readFileSync(resolve(testDir, '.gitignore'), 'utf-8');
    expect(content).toBe('node_modules/\n.flux/\n');
  });

  it('does not duplicate .flux/ entry', () => {
    writeFileSync(resolve(testDir, '.gitignore'), '.flux/\n');
    execSync(`bun "${CLI_PATH}" init --force --no-agents`, { cwd: testDir, stdio: 'pipe' });
    const content = readFileSync(resolve(testDir, '.gitignore'), 'utf-8');
    expect(content.match(/\.flux\//g)?.length).toBe(1);
  });

  it('adds newline before .flux/ if missing', () => {
    writeFileSync(resolve(testDir, '.gitignore'), 'node_modules/');
    execSync(`bun "${CLI_PATH}" init --force --no-agents`, { cwd: testDir, stdio: 'pipe' });
    const content = readFileSync(resolve(testDir, '.gitignore'), 'utf-8');
    expect(content).toBe('node_modules/\n.flux/\n');
  });

  it('creates .gitignore at git root from subdirectory', () => {
    const subdir = resolve(testDir, 'subdir');
    mkdirSync(subdir);
    execSync(`bun "${CLI_PATH}" init --force --no-agents`, { cwd: subdir, stdio: 'pipe' });
    expect(existsSync(resolve(testDir, '.gitignore'))).toBe(true);
    expect(existsSync(resolve(subdir, '.gitignore'))).toBe(false);
    const content = readFileSync(resolve(testDir, '.gitignore'), 'utf-8');
    expect(content).toContain('.flux/');
  });
});
