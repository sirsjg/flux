import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  getTasks,
  initStore,
  isTaskBlocked,
  removeDependency,
  setStorageAdapter,
  updateTask,
} from '../src/store.js';

type AdapterData = Store & { project?: Store['projects'][number] };

function createAdapter(initial?: Partial<AdapterData>) {
  const data: AdapterData = {
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

describe('store', () => {
  beforeEach(() => {
    const adapter = createAdapter();
    setStorageAdapter(adapter);
    initStore();
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
    const adapter = createAdapter(legacyData);

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
});
