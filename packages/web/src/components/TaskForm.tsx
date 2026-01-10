import { useState, useEffect } from "preact/hooks";
import { Modal } from "./Modal";
import {
  createTask,
  updateTask,
  deleteTask,
  getEpics,
  getTasks,
  type TaskWithBlocked,
} from "../stores";
import type { Task, Epic, Status } from "@flux/shared";
import { STATUSES, STATUS_CONFIG } from "@flux/shared";

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  task?: Task; // If provided, edit mode; otherwise create mode
  projectId: string;
  defaultEpicId?: string; // Pre-select epic when creating new task
}

export function TaskForm({
  isOpen,
  onClose,
  onSave,
  task,
  projectId,
  defaultEpicId,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string>("todo");
  const [epicId, setEpicId] = useState<string>("");
  const [epics, setEpics] = useState<Epic[]>([]);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [availableTasks, setAvailableTasks] = useState<TaskWithBlocked[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dependencyFilter, setDependencyFilter] = useState("");

  const isEdit = !!task;

  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen, task, projectId, defaultEpicId]);

  const loadFormData = async () => {
    const [epicsData, tasksData] = await Promise.all([
      getEpics(projectId),
      getTasks(projectId),
    ]);
    setEpics(epicsData);
    setAvailableTasks(
      task ? tasksData.filter((t) => t.id !== task.id) : tasksData
    );

    setDependencyFilter("");
    if (task) {
      setTitle(task.title);
      setNotes(Array.isArray(task.notes) ? task.notes.join("\n") : (task.notes || ""));
      setStatus(task.status);
      setEpicId(task.epic_id || "");
      setDependsOn([...task.depends_on]);
    } else {
      setTitle("");
      setNotes("");
      setStatus("todo");
      setEpicId(defaultEpicId || "");
      setDependsOn([]);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (isEdit && task) {
        await updateTask(task.id, {
          title: title.trim(),
          notes: notes.trim(),
          status,
          epic_id: epicId || undefined,
          depends_on: dependsOn,
        });
      } else {
        const newTask = await createTask(
          projectId,
          title.trim(),
          epicId || undefined,
          notes.trim()
        );
        if (dependsOn.length > 0) {
          await updateTask(newTask.id, { depends_on: dependsOn });
        }
      }
      await onSave();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (task && confirm("Delete this task?")) {
      setSubmitting(true);
      await deleteTask(task.id);
      await onSave();
      onClose();
      setSubmitting(false);
    }
  };

  const toggleDependency = (taskId: string) => {
    setDependsOn((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Task" : "New Task"}
    >
      <form onSubmit={handleSubmit}>
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Title *</span>
          </label>
          <input
            type="text"
            placeholder="Task title"
            class="input input-bordered w-full"
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            required
          />
        </div>

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Notes</span>
          </label>
          <textarea
            placeholder="Optional notes..."
            class="textarea textarea-bordered w-full"
            value={notes}
            onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
            rows={3}
          />
        </div>

        {isEdit && (
          <div class="form-control mb-4">
            <label class="label">
              <span class="label-text">Status</span>
            </label>
            <select
              class="select select-bordered w-full"
              value={status}
              onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Epic</span>
          </label>
          <select
            class="select select-bordered w-full"
            value={epicId}
            onChange={(e) => setEpicId((e.target as HTMLSelectElement).value)}
          >
            <option value="">Unassigned</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.title}
              </option>
            ))}
          </select>
        </div>

        <div class="form-control mb-6">
          <label class="label">
            <span class="label-text">Dependencies</span>
            {dependsOn.length > 0 && (
              <span class="label-text-alt">{dependsOn.length} selected</span>
            )}
          </label>
          {availableTasks.length === 0 ? (
            <p class="text-sm text-base-content/50">No other tasks available</p>
          ) : (
            <div class="border border-base-300 rounded-lg">
              {availableTasks.length > 3 && (
                <div class="px-3 py-2 border-b border-base-300">
                  <input
                    type="text"
                    placeholder="Filter tasks..."
                    class="input input-bordered input-sm w-full"
                    value={dependencyFilter}
                    onInput={(e) =>
                      setDependencyFilter((e.target as HTMLInputElement).value)
                    }
                  />
                </div>
              )}
              <div class="max-h-32 overflow-y-auto">
                {availableTasks
                  .filter(
                    (t) =>
                      !dependencyFilter ||
                      t.title
                        .toLowerCase()
                        .includes(dependencyFilter.toLowerCase())
                  )
                  .map((t) => (
                    <label
                      key={t.id}
                      class="flex items-center gap-2 px-3 py-2 hover:bg-base-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm"
                        checked={dependsOn.includes(t.id)}
                        onChange={() => toggleDependency(t.id)}
                      />
                      <span class="text-sm truncate flex-1">{t.title}</span>
                      <span class="badge badge-ghost badge-xs">
                        {STATUS_CONFIG[t.status as Status]?.label || t.status}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div class="modal-action">
          {isEdit && (
            <button
              type="button"
              class="btn btn-error btn-outline"
              onClick={handleDelete}
              disabled={submitting}
            >
              Delete
            </button>
          )}
          <button type="button" class="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={!title.trim() || submitting}
          >
            {submitting ? (
              <span class="loading loading-spinner loading-sm"></span>
            ) : isEdit ? (
              "Save"
            ) : (
              "Create"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
