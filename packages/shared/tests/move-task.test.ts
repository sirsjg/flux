import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  setStorageAdapter,
  initStore,
  createProject,
  createEpic,
  createTask,
  updateTask,
  addTaskComment,
  getTasks,
  getTasksByEpic,
  getProjectStats,
  getTask,
  isTaskBlocked,
  deleteTaskComment,
} from '../src/store.js';
import type { Store } from '../src/types.js';

function createAdapter(initial?: Partial<Store>) {
  const data: Store = {
    projects: [],
    epics: [],
    tasks: [],
    ...initial,
  };
  return {
    data,
    read: vi.fn(),
    write: vi.fn(),
  };
}

describe('move task between projects', () => {
  beforeEach(() => {
    const adapter = createAdapter();
    setStorageAdapter(adapter);
    initStore();
  });

  it('changes project_id and preserves all other fields', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const task = createTask(projectA.id, 'Old title', undefined, {
      description: 'Some context',
      acceptance_criteria: ['Criterion 1'],
      guardrails: [{ id: 'g1', number: 999, text: 'Keep me' }],
    });
    addTaskComment(task.id, 'A comment', 'user');

    const moved = updateTask(task.id, { project_id: projectB.id });

    expect(moved?.id).toBe(task.id);
    expect(moved?.project_id).toBe(projectB.id);
    // updated_at is set by the update (a real ISO timestamp); no need to
    // assert exact equality since the clock can advance within the same tick.
    expect(moved?.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Preserved payloads
    expect(moved?.description).toBe('Some context');
    expect(moved?.acceptance_criteria).toEqual(['Criterion 1']);
    expect(moved?.comments).toEqual([
      expect.objectContaining({ body: 'A comment', author: 'user' }),
    ]);
    expect(moved?.guardrails).toEqual([{ id: 'g1', number: 999, text: 'Keep me' }]);
    expect(moved?.depends_on).toEqual([]);
  });

  it('keeps the task out of the source project and inside the target', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const task = createTask(projectA.id, 'Task');

    updateTask(task.id, { project_id: projectB.id });

    expect(getTasks(projectA.id)).toHaveLength(0);
    expect(getTasks(projectB.id)).toEqual([
      expect.objectContaining({ id: task.id, project_id: projectB.id }),
    ]);
  });

  it('updates project stats after a move', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    createTask(projectA.id, 'Task A');
    const taskB = createTask(projectA.id, 'Task B');

    updateTask(taskB.id, { project_id: projectB.id });

    expect(getProjectStats(projectA.id)).toEqual({ total: 1, done: 0 });
    expect(getProjectStats(projectB.id)).toEqual({ total: 1, done: 0 });
  });

  it('preserves blocked state and dependencies on a move', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const blocker = createTask(projectA.id, 'Blocker');
    const task = createTask(projectA.id, 'Task', undefined, {
      description: 'Waiting on vendor',
    });
    addTaskComment(task.id, 'wait', 'user');
    updateTask(task.id, { depends_on: [blocker.id] });
    updateTask(task.id, { blocked_reason: 'Waiting on vendor' });

    const moved = updateTask(task.id, { project_id: projectB.id });

    expect(moved?.blocked_reason).toBe('Waiting on vendor');
    expect(moved?.depends_on).toEqual([blocker.id]);
    expect(moved?.comments).toEqual([
      expect.objectContaining({ body: 'wait' }),
    ]);
    expect(isTaskBlocked(moved!.id)).toBe(true);
  });

  it('keeps it in place when project_id is unchanged', () => {
    const projectA = createProject('Project A');
    const task = createTask(projectA.id, 'Task');
    const unchanged = updateTask(task.id, { project_id: projectA.id });
    expect(unchanged?.project_id).toBe(projectA.id);
    expect(getTasks(projectA.id)).toEqual([expect.objectContaining({ id: task.id })]);
  });

  it('rejects a move that would orphan an epic cross-project', () => {
    // The server enforces this as a 409; the store enforces the same rule so
    // local/file mode behaves identically. The server test asserts the 409
    // status (packages/server/tests/move-task.test.ts).
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const epic = createEpic(projectA.id, 'Epic in A');
    const task = createTask(projectA.id, 'Task under epic', epic.id);

    expect(() => updateTask(task.id, { project_id: projectB.id })).toThrow(
      /belongs to epic "Epic in A" in a different project/
    );
    // The task must not have moved.
    expect(getTask(task.id)?.project_id).toBe(projectA.id);
  });

  it('allows a move when the epic already belongs to the target project', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const epic = createEpic(projectB.id, 'Epic in B');
    const task = createTask(projectA.id, 'Task under epic', epic.id);

    const moved = updateTask(task.id, { project_id: projectB.id });
    expect(moved?.project_id).toBe(projectB.id);
  });

  it('allows a move for a task with no epic', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const task = createTask(projectA.id, 'No epic');

    const moved = updateTask(task.id, { project_id: projectB.id });
    expect(moved?.project_id).toBe(projectB.id);
  });

  // A save is one atomic update: the client sends the field changes AND the
  // move in a single PATCH, so the guard must judge the epic the task has
  // AFTER the other fields are applied (the combined unassign + move).
  it('unassigns the epic and moves the task when both arrive in one update', () => {
    const projectA = createProject('Project A');
    const projectB = createProject('Project B');
    const epic = createEpic(projectA.id, 'Epic in A');
    const task = createTask(projectA.id, 'Task under epic', epic.id);

    const moved = updateTask(task.id, { epic_id: null, project_id: projectB.id });

    expect(moved?.project_id).toBe(projectB.id);
    expect(moved?.epic_id).toBeUndefined();
    // The task is reachable from the target project and no longer under the
    // source epic.
    expect(getTasks(projectB.id)).toEqual([expect.objectContaining({ id: task.id })]);
    expect(getTasksByEpic(projectA.id, epic.id)).toHaveLength(0);
  });

  it('applies field changes without moving when only epic_id is cleared', () => {
    const projectA = createProject('Project A');
    const task = createTask(projectA.id, 'Task under epic', undefined);
    const epic = createEpic(projectA.id, 'Epic in A');
    updateTask(task.id, { epic_id: epic.id });

    const updated = updateTask(task.id, { epic_id: null });

    expect(updated?.epic_id).toBeUndefined();
    expect(updated?.project_id).toBe(projectA.id);
    expect(getTasksByEpic(projectA.id, epic.id)).toHaveLength(0);
  });

  it('stores a cleared epic_id as absent, never as a persisted null', () => {
    const projectA = createProject('Project A');
    const task = createTask(projectA.id, 'Task under epic', undefined);
    const epic = createEpic(projectA.id, 'Epic in A');
    updateTask(task.id, { epic_id: epic.id });

    updateTask(task.id, { epic_id: null });

    const stored = getTask(task.id)!;
    expect(stored.epic_id).toBeUndefined();
    // A null that leaked into the store would survive a JSON round trip and
    // break the strict `epic_id === undefined` comparisons elsewhere.
    expect('epic_id' in (JSON.parse(JSON.stringify(stored)))).toBe(false);
  });

  it('reassigning to an epic in the same project is allowed', () => {
    const projectA = createProject('Project A');
    const epic1 = createEpic(projectA.id, 'First epic');
    const epic2 = createEpic(projectA.id, 'Second epic');
    const task = createTask(projectA.id, 'Task', epic1.id);

    const updated = updateTask(task.id, { epic_id: epic2.id });

    expect(updated?.epic_id).toBe(epic2.id);
    expect(getTasksByEpic(projectA.id, epic2.id)).toEqual([
      expect.objectContaining({ id: task.id }),
    ]);
  });

  it('a no-op move still clears the epic when it is the only change', () => {
    const projectA = createProject('Project A');
    const task = createTask(projectA.id, 'Task under epic', undefined);
    const epic = createEpic(projectA.id, 'Epic in A');
    updateTask(task.id, { epic_id: epic.id });

    const updated = updateTask(task.id, { epic_id: null, project_id: projectA.id });

    expect(updated?.epic_id).toBeUndefined();
    expect(updated?.project_id).toBe(projectA.id);
  });
});
