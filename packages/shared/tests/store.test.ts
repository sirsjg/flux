import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Store } from '../src/types.js';
import {
  addDependency,
  addTaskComment,
  archiveDoneTasks,
  cleanupProject,
  createEpic,
  createProject,
  createTask,
  deleteProject,
  deleteTaskComment,
  getProject,
  getReadyTasks,
  getTasks,
  isTaskBlocked,
  removeDependency,
  updateTask,
} from '../src/store.js';
import { cleanupTempDatabases } from './test-cleanup.js';
import { setupTestStore, createTestAdapter } from './test-helpers.js';
import { setStorageAdapter, initStore } from '../src/store.js';

type AdapterData = Store & { project?: Store['projects'][number] };

describe('store', () => {
  beforeEach(() => {
    setupTestStore();
  });

  afterAll(() => {
    // Clean up any temp SQLite files that may have been created
    cleanupTempDatabases();
  });

  it('migrates legacy project data on init', () => {
    const legacyData: AdapterData = {
      project: { id: 'legacy', name: 'Legacy' },
      projects: undefined,
      tasks: [
        {
          id: 'task-1',
          title: 'Legacy task',
          status: 'todo',
          depends_on: [],
          notes: '',
        } as Store['tasks'][number],
      ],
      epics: [
        {
          id: 'epic-1',
          title: 'Legacy epic',
          status: 'todo',
          depends_on: [],
          notes: '',
          auto: false,
        } as Store['epics'][number],
      ],
    };
    const adapter = createTestAdapter(legacyData);

    setStorageAdapter(adapter);
    initStore();

    expect(adapter.data.projects).toHaveLength(1);
    expect(adapter.data.projects[0].id).toBe('legacy');
    expect(adapter.data.tasks[0].project_id).toBe('legacy');
    expect(adapter.data.epics[0].project_id).toBe('legacy');
    expect(adapter.data.project).toBeUndefined();
    expect(adapter.write).toHaveBeenCalledTimes(1);
  });

  it('removes tasks and epics when a project is deleted', () => {
    const project = createProject('Project');
    const epic = createEpic(project.id, 'Epic');
    createTask(project.id, 'Task', epic.id);

    deleteProject(project.id);

    expect(getProject(project.id)).toBeUndefined();
    expect(getTasks(project.id)).toHaveLength(0);
  });

  it('tracks dependencies and blocked state', () => {
    const project = createProject('Project');
    const blocker = createTask(project.id, 'Blocker');
    const blocked = createTask(project.id, 'Blocked');

    expect(addDependency(blocked.id, blocker.id)).toBe(true);
    expect(isTaskBlocked(blocked.id)).toBe(true);

    updateTask(blocker.id, { status: 'done' });
    expect(isTaskBlocked(blocked.id)).toBe(false);

    expect(removeDependency(blocked.id, blocker.id)).toBe(true);
    expect(isTaskBlocked(blocked.id)).toBe(false);
  });

  it('archives done tasks and cleans up empty epics', () => {
    const project = createProject('Project');
    const epic = createEpic(project.id, 'Epic');
    const doneTask = createTask(project.id, 'Done', epic.id);
    const todoTask = createTask(project.id, 'Todo');

    updateTask(doneTask.id, { status: 'done' });

    expect(archiveDoneTasks(project.id)).toBe(1);
    expect(getTasks(project.id)).toHaveLength(1);
    expect(getTasks(project.id)[0].id).toBe(todoTask.id);

    const result = cleanupProject(project.id, false, true);
    expect(result).toEqual({ archivedTasks: 0, deletedEpics: 1 });
  });

  it('adds and deletes task comments', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task');
    const comment = addTaskComment(task.id, 'First', 'user');

    expect(comment?.body).toBe('First');
    expect(task.comments).toHaveLength(1);

    const deleted = deleteTaskComment(task.id, comment!.id);
    expect(deleted).toBe(true);
    expect(task.comments).toHaveLength(0);
  });

  it('detects circular dependencies on update', () => {
    const project = createProject('Project');
    const taskA = createTask(project.id, 'Task A');
    const taskB = createTask(project.id, 'Task B');

    // A depends on B
    updateTask(taskA.id, { depends_on: [taskB.id] });

    // B depending on A would create a cycle
    expect(() => updateTask(taskB.id, { depends_on: [taskA.id] })).toThrow('Circular dependency detected');
  });

  it('detects indirect circular dependencies', () => {
    const project = createProject('Project');
    const taskA = createTask(project.id, 'Task A');
    const taskB = createTask(project.id, 'Task B');
    const taskC = createTask(project.id, 'Task C');

    // A -> B -> C
    updateTask(taskA.id, { depends_on: [taskB.id] });
    updateTask(taskB.id, { depends_on: [taskC.id] });

    // C -> A would create a cycle
    expect(() => updateTask(taskC.id, { depends_on: [taskA.id] })).toThrow('Circular dependency detected');
  });

  it('rejects non-existent dependencies on create', () => {
    const project = createProject('Project');

    expect(() => createTask(project.id, 'Task', undefined, { depends_on: ['nonexistent'] })).toThrow('Dependency not found');
  });

  it('rejects non-existent dependencies on update', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task');

    expect(() => updateTask(task.id, { depends_on: ['nonexistent'] })).toThrow('Dependency not found');
  });

  it('prevents circular dependency via addDependency', () => {
    const project = createProject('Project');
    const taskA = createTask(project.id, 'Task A');
    const taskB = createTask(project.id, 'Task B');

    addDependency(taskA.id, taskB.id);
    // B -> A would create a cycle, addDependency returns false
    expect(addDependency(taskB.id, taskA.id)).toBe(false);
  });

  it('detects self-dependency as circular', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task');

    expect(() => updateTask(task.id, { depends_on: [task.id] })).toThrow('Circular dependency detected');
  });

  it('addDependency rejects nonexistent dependency', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task');

    expect(addDependency(task.id, 'nonexistent')).toBe(false);
  });

  it('creates task with acceptance_criteria', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task', undefined, {
      acceptance_criteria: ['Processes in <100ms', 'Returns valid JSON'],
    });

    expect(task.acceptance_criteria).toHaveLength(2);
    expect(task.acceptance_criteria?.[0]).toBe('Processes in <100ms');
  });

  it('creates task with guardrails and generates IDs', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task', undefined, {
      guardrails: [
        { number: 999, text: 'Do not delete data' } as any,
        { id: 'existing-id', number: 9999, text: 'Always backup' },
      ],
    });

    expect(task.guardrails).toHaveLength(2);
    expect(task.guardrails?.[0].id).toBeDefined();
    expect(task.guardrails?.[0].number).toBe(999);
    expect(task.guardrails?.[1].id).toBe('existing-id');
  });

  it('updates task acceptance_criteria (replace mode)', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task', undefined, {
      acceptance_criteria: ['Original criterion'],
    });

    const updated = updateTask(task.id, { acceptance_criteria: ['New criterion 1', 'New criterion 2'] });

    expect(updated?.acceptance_criteria).toHaveLength(2);
    expect(updated?.acceptance_criteria?.[0]).toBe('New criterion 1');
  });

  it('updates task guardrails (replace mode)', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task', undefined, {
      guardrails: [{ id: 'g1', number: 1, text: 'Original' }],
    });

    const updated = updateTask(task.id, { guardrails: [{ number: 999, text: 'New guardrail' } as any] });

    expect(updated?.guardrails).toHaveLength(1);
    expect(updated?.guardrails?.[0].number).toBe(999);
    expect(updated?.guardrails?.[0].id).toBeDefined();
  });

  it('clears acceptance_criteria with empty array', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task', undefined, {
      acceptance_criteria: ['Criterion 1'],
    });

    const updated = updateTask(task.id, { acceptance_criteria: [] });

    expect(updated?.acceptance_criteria).toHaveLength(0);
  });

  it('clears guardrails with empty array', () => {
    const project = createProject('Project');
    const task = createTask(project.id, 'Task', undefined, {
      guardrails: [{ id: 'g1', number: 999, text: 'Guardrail' }],
    });

    const updated = updateTask(task.id, { guardrails: [] });

    expect(updated?.guardrails).toHaveLength(0);
  });

  describe('priority sorting', () => {
    it('sorts ready tasks by priority: P0 > P1 > P2 > null', () => {
      const project = createProject('Project');
      const p2Task = createTask(project.id, 'P2 task', undefined, { priority: 2 });
      const p0Task = createTask(project.id, 'P0 task', undefined, { priority: 0 });
      const nullTask = createTask(project.id, 'No priority');
      const p1Task = createTask(project.id, 'P1 task', undefined, { priority: 1 });

      const ready = getReadyTasks(project.id);

      expect(ready).toHaveLength(4);
      expect(ready[0].id).toBe(p0Task.id); // P0 first
      expect(ready[1].id).toBe(p1Task.id); // P1 second
      // P2 and null both treated as priority 2
      expect([p2Task.id, nullTask.id]).toContain(ready[2].id);
      expect([p2Task.id, nullTask.id]).toContain(ready[3].id);
    });

    it('excludes blocked tasks from ready list regardless of priority', () => {
      const project = createProject('Project');
      const blocker = createTask(project.id, 'Blocker', undefined, { priority: 2 });
      const p0Blocked = createTask(project.id, 'P0 but blocked', undefined, { priority: 0 });
      const p1Ready = createTask(project.id, 'P1 ready', undefined, { priority: 1 });

      addDependency(p0Blocked.id, blocker.id);

      const ready = getReadyTasks(project.id);

      expect(ready).toHaveLength(2); // blocker and p1Ready
      expect(ready.find(t => t.id === p0Blocked.id)).toBeUndefined();
    });

    it('excludes done and archived tasks from ready list', () => {
      const project = createProject('Project');
      const doneTask = createTask(project.id, 'Done task', undefined, { priority: 0 });
      const archivedTask = createTask(project.id, 'Archived task', undefined, { priority: 0 });
      const readyTask = createTask(project.id, 'Ready task', undefined, { priority: 1 });

      updateTask(doneTask.id, { status: 'done' });
      updateTask(archivedTask.id, { archived: true });

      const ready = getReadyTasks(project.id);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(readyTask.id);
    });

    it('filters ready tasks by project when projectId provided', () => {
      const project1 = createProject('Project 1');
      const project2 = createProject('Project 2');
      const task1 = createTask(project1.id, 'Task 1', undefined, { priority: 0 });
      const task2 = createTask(project2.id, 'Task 2', undefined, { priority: 0 });

      const ready = getReadyTasks(project1.id);

      expect(ready).toHaveLength(1);
      expect(ready[0].id).toBe(task1.id);
    });

    it('creates task with priority', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Urgent', undefined, { priority: 0 });

      expect(task.priority).toBe(0);
    });

    it('updates task priority', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 2 });

      const updated = updateTask(task.id, { priority: 0 });

      expect(updated?.priority).toBe(0);
    });

    it('clears task priority by setting to undefined', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 0 });

      const updated = updateTask(task.id, { priority: undefined });

      expect(updated?.priority).toBeUndefined();
    });

    it('updateTask() changes priority from one value to another', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 2 });

      expect(task.priority).toBe(2);

      const updated = updateTask(task.id, { priority: 1 });
      expect(updated?.priority).toBe(1);

      const updatedAgain = updateTask(task.id, { priority: 0 });
      expect(updatedAgain?.priority).toBe(0);
    });

    it('priority can be set to null', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 1 });

      expect(task.priority).toBe(1);

      const updated = updateTask(task.id, { priority: null as any });

      expect(updated?.priority).toBeNull();
    });

    it('priority updates trigger data write', () => {
      const adapter = createTestAdapter();
      setStorageAdapter(adapter);
      initStore();

      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 2 });

      // Reset write mock to count only the priority update write
      adapter.write.mockClear();

      updateTask(task.id, { priority: 0 });

      expect(adapter.write).toHaveBeenCalledTimes(1);

      // Reset and test clearing priority
      adapter.write.mockClear();

      updateTask(task.id, { priority: undefined });

      expect(adapter.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('priority defaults and validation', () => {
    it('null/undefined priority is treated as P2 (lowest priority) in sorting', () => {
      const project = createProject('Project');
      const nullTask = createTask(project.id, 'Null priority task'); // No priority specified
      const p0Task = createTask(project.id, 'P0 task', undefined, { priority: 0 });
      const p1Task = createTask(project.id, 'P1 task', undefined, { priority: 1 });
      const p2Task = createTask(project.id, 'P2 task', undefined, { priority: 2 });

      const ready = getReadyTasks(project.id);

      // Verify null priority task is treated same as P2
      expect(ready[0].id).toBe(p0Task.id); // P0 highest
      expect(ready[1].id).toBe(p1Task.id); // P1 middle
      // P2 and null both at end (order between them doesn't matter)
      const lastTwo = [ready[2].id, ready[3].id];
      expect(lastTwo).toContain(p2Task.id);
      expect(lastTwo).toContain(nullTask.id);
    });

    it('rejects invalid priority values on create', () => {
      const project = createProject('Project');

      // Invalid priority values should throw errors
      expect(() => createTask(project.id, 'Invalid priority', undefined, { priority: 3 as any })).toThrow('Invalid priority value: 3. Must be 0, 1, or 2.');
      expect(() => createTask(project.id, 'Invalid priority', undefined, { priority: -1 as any })).toThrow('Invalid priority value: -1. Must be 0, 1, or 2.');
      expect(() => createTask(project.id, 'Invalid priority', undefined, { priority: 'high' as any })).toThrow('Invalid priority value: high. Must be 0, 1, or 2.');
      expect(() => createTask(project.id, 'Invalid priority', undefined, { priority: 99 as any })).toThrow('Invalid priority value: 99. Must be 0, 1, or 2.');
    });

    it('rejects invalid priority values on update', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 1 });

      // Invalid priority values should throw errors
      expect(() => updateTask(task.id, { priority: 3 as any })).toThrow('Invalid priority value: 3. Must be 0, 1, or 2.');
      expect(() => updateTask(task.id, { priority: -1 as any })).toThrow('Invalid priority value: -1. Must be 0, 1, or 2.');
      expect(() => updateTask(task.id, { priority: 'high' as any })).toThrow('Invalid priority value: high. Must be 0, 1, or 2.');
      expect(() => updateTask(task.id, { priority: 5.5 as any })).toThrow('Invalid priority value: 5.5. Must be 0, 1, or 2.');
    });

    it('priority persists across multiple updates', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 0 });

      // Update title - priority should persist
      let updated = updateTask(task.id, { title: 'Updated title' });
      expect(updated?.priority).toBe(0);

      // Update status - priority should persist
      updated = updateTask(task.id, { status: 'in_progress' });
      expect(updated?.priority).toBe(0);

      // Update epic - priority should persist
      const epic = createEpic(project.id, 'Epic');
      updated = updateTask(task.id, { epic_id: epic.id });
      expect(updated?.priority).toBe(0);

      // Change priority
      updated = updateTask(task.id, { priority: 2 });
      expect(updated?.priority).toBe(2);

      // Update title again - new priority should persist
      updated = updateTask(task.id, { title: 'Another update' });
      expect(updated?.priority).toBe(2);
    });

    it('accepts all valid priority values (0, 1, 2)', () => {
      const project = createProject('Project');

      const p0Task = createTask(project.id, 'P0', undefined, { priority: 0 });
      const p1Task = createTask(project.id, 'P1', undefined, { priority: 1 });
      const p2Task = createTask(project.id, 'P2', undefined, { priority: 2 });

      expect(p0Task.priority).toBe(0);
      expect(p1Task.priority).toBe(1);
      expect(p2Task.priority).toBe(2);
    });

    it('allows priority to be set to undefined (clearing priority)', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 0 });

      expect(task.priority).toBe(0);

      const updated = updateTask(task.id, { priority: undefined });
      expect(updated?.priority).toBeUndefined();
    });

    it('allows priority to be set to null', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 1 });

      expect(task.priority).toBe(1);

      const updated = updateTask(task.id, { priority: null as any });

      expect(updated?.priority).toBeNull();
    });

    it('validates priority when other fields are also updated', () => {
      const project = createProject('Project');
      const task = createTask(project.id, 'Task', undefined, { priority: 1 });

      // Should reject invalid priority even when updating other fields
      expect(() => updateTask(task.id, { title: 'New title', priority: 10 as any })).toThrow('Invalid priority value: 10. Must be 0, 1, or 2.');

      // Task should remain unchanged after failed update
      const unchanged = getTasks(project.id).find(t => t.id === task.id);
      expect(unchanged?.title).toBe('Task');
      expect(unchanged?.priority).toBe(1);
    });
  });
});
