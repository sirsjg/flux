import { useState, useEffect } from "preact/hooks";
import { ConfirmModal } from "./ConfirmModal";
import { Modal } from "./Modal";
import { Input, Textarea } from "./Input";
import { Select } from "./FormControls";
import { Checkbox } from "./FormControls";
import { Button } from "./Button";
import { Badge } from "./Badge";
import {
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  deleteTaskComment,
  getEpics,
  getTasks,
  type TaskWithBlocked,
} from "../stores";
import type { Task, Epic, Status, TaskComment, Guardrail, TaskType } from "@flux/shared";
import { STATUSES, STATUS_CONFIG, PRIORITIES, PRIORITY_CONFIG, TASK_TYPES, TASK_TYPE_CONFIG, type Priority } from "@flux/shared";
import "./TaskForm.css";

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
  const [status, setStatus] = useState<string>("todo");
  const [epicId, setEpicId] = useState<string>("");
  const [priority, setPriority] = useState<Priority | undefined>(undefined);
  const [type, setType] = useState<TaskType>("task");
  const [epics, setEpics] = useState<Epic[]>([]);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [availableTasks, setAvailableTasks] = useState<TaskWithBlocked[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dependencyFilter, setDependencyFilter] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>([]);
  const [newCriterion, setNewCriterion] = useState("");
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [newGuardrailNumber, setNewGuardrailNumber] = useState("");
  const [newGuardrailText, setNewGuardrailText] = useState("");

  const isEdit = task !== undefined;

  useEffect(() => {
    if (isOpen) {
      setDeleteConfirmOpen(false);
      setDeleteCommentId(null);
      void loadFormData();
    } else {
      setDeleteConfirmOpen(false);
      setDeleteCommentId(null);
    }
  }, [isOpen, task, projectId, defaultEpicId]);

  const loadFormData = async () => {
    const [epicsData, tasksData] = await Promise.all([
      getEpics(projectId),
      getTasks(projectId),
    ]);
    setEpics(epicsData);
    setAvailableTasks(
      task !== undefined ? tasksData.filter((t) => t.id !== task.id) : tasksData
    );

    setDependencyFilter("");
    setNewCriterion("");
    setNewGuardrailNumber("");
    setNewGuardrailText("");
    if (task !== undefined) {
      setTitle(task.title);
      setStatus(task.status);
      setEpicId(task.epic_id ?? "");
      setPriority(task.priority);
      setType(task.type ?? "task");
      setDependsOn([...task.depends_on]);
      setComments(task.comments !== undefined ? [...task.comments] : []);
      setBlockedReason(task.blocked_reason ?? "");
      setAcceptanceCriteria(task.acceptance_criteria !== undefined ? [...task.acceptance_criteria] : []);
      setGuardrails(task.guardrails !== undefined ? [...task.guardrails] : []);
    } else {
      setTitle("");
      setStatus("todo");
      setEpicId(defaultEpicId ?? "");
      setPriority(undefined);
      setType("task");
      setDependsOn([]);
      setComments([]);
      setBlockedReason("");
      setAcceptanceCriteria([]);
      setGuardrails([]);
    }
  };

  const handleSubmit = async (e: Event): Promise<void> => {
    e.preventDefault();
    if (title.trim() === "" || submitting) return;

    setSubmitting(true);
    try {
      if (task !== undefined) {
        await updateTask(task.id, {
          title: title.trim(),
          status,
          epic_id: epicId !== "" ? epicId : undefined,
          priority: priority,
          type: type,
          depends_on: dependsOn,
          blocked_reason: blockedReason.trim() !== "" ? blockedReason.trim() : undefined,
          acceptance_criteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
          guardrails: guardrails.length > 0 ? guardrails : undefined,
        });
      } else {
        const newTask = await createTask(
          projectId,
          title.trim(),
          epicId !== "" ? epicId : undefined
        );
        const updates: Partial<Task> = {};
        if (priority !== undefined) updates.priority = priority;
        updates.type = type; // Always set type (defaults to 'task')
        if (dependsOn.length > 0) updates.depends_on = dependsOn;
        if (acceptanceCriteria.length > 0) updates.acceptance_criteria = acceptanceCriteria;
        if (guardrails.length > 0) updates.guardrails = guardrails;
        if (Object.keys(updates).length > 0) {
          await updateTask(newTask.id, updates);
        }
      }
      await onSave();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (): void => {
    if (task !== undefined && !submitting) {
      setDeleteConfirmOpen(true);
    }
  };

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (task === undefined || submitting) return;
    setSubmitting(true);
    try {
      await deleteTask(task.id);
      await onSave();
      onClose();
    } finally {
      setSubmitting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleAddComment = async (): Promise<void> => {
    if (task === undefined || commentBody.trim() === "" || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const comment = await addTaskComment(task.id, commentBody.trim(), "user");
      setComments((prev) => [...prev, comment]);
      setCommentBody("");
      await onSave();
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: string): void => {
    if (task === undefined || commentSubmitting) return;
    setDeleteCommentId(commentId);
  };

  const handleDeleteCommentConfirmed = async (): Promise<void> => {
    if (task === undefined || commentSubmitting || deleteCommentId === null) return;
    setCommentSubmitting(true);
    try {
      const success = await deleteTaskComment(task.id, deleteCommentId);
      if (success) {
        setComments((prev) =>
          prev.filter((comment) => comment.id !== deleteCommentId)
        );
        await onSave();
      }
    } finally {
      setCommentSubmitting(false);
      setDeleteCommentId(null);
    }
  };

  const toggleDependency = (taskId: string): void => {
    setDependsOn((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const addCriterion = (): void => {
    if (newCriterion.trim() === "") return;
    setAcceptanceCriteria((prev) => [...prev, newCriterion.trim()]);
    setNewCriterion("");
  };

  const removeCriterion = (index: number): void => {
    setAcceptanceCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuardrail = (): void => {
    const num = Math.floor(parseInt(newGuardrailNumber));
    if (isNaN(num) || num <= 0 || newGuardrailText.trim() === "") return;
    setGuardrails((prev) => [...prev, { id: crypto.randomUUID(), number: num, text: newGuardrailText.trim() }]);
    setNewGuardrailNumber("");
    setNewGuardrailText("");
  };

  const removeGuardrail = (id: string): void => {
    setGuardrails((prev) => prev.filter((g) => g.id !== id));
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Task" : "New Task"}
        boxClassName="!w-[70vw] !max-w-none"
      >
        <form onSubmit={(e) => void handleSubmit(e)} className="task-form">
        <div className="task-form-grid">
          <div className="task-form-section">
            <div className="task-form-group">
              <label className="task-form-label">
                <span>Title *</span>
              </label>
              <Input
                type="text"
                placeholder="Task title"
                value={title}
                onChange={(value) => setTitle(value)}
                required
              />
            </div>

            {isEdit && (
              <div className="task-form-group">
                <label className="task-form-label">Status</label>
                <Select
                  options={STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
                  value={status}
                  onChange={(value) => setStatus(value)}
                />
              </div>
            )}

            {isEdit && (
              <div className="task-form-group">
                <label className="task-form-label">
                  <span>External Blocker</span>
                  {blockedReason !== "" && <span className="task-form-badge-blocked">Blocked</span>}
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Waiting for vendor quote"
                  value={blockedReason}
                  onChange={(value) => setBlockedReason(value)}
                />
                <span className="task-form-helper">
                  Set to block task on external process. Clear to unblock.
                </span>
              </div>
            )}

            <div className="task-form-group">
              <label className="task-form-label">Epic</label>
              <Select
                options={[
                  { value: "", label: "Unassigned" },
                  ...epics.map((epic) => ({ value: epic.id, label: epic.title }))
                ]}
                value={epicId}
                onChange={(value) => setEpicId(value)}
              />
            </div>

            <div className="task-form-group">
              <label className="task-form-label">Priority</label>
              <Select
                options={[
                  { value: "", label: "Default (P1)" },
                  ...PRIORITIES.map((p) => ({
                    value: String(p),
                    label: `${PRIORITY_CONFIG[p].label} - ${p === 0 ? 'Urgent' : p === 1 ? 'Normal' : 'Low'}`
                  }))
                ]}
                value={priority !== undefined ? String(priority) : ""}
                onChange={(val) => setPriority(val === "" ? undefined : parseInt(val) as Priority)}
              />
            </div>

            <div className="task-form-group">
              <label className="task-form-label">Type</label>
              <Select
                options={TASK_TYPES.map((t) => ({
                  value: t,
                  label: `${TASK_TYPE_CONFIG[t].symbol} ${TASK_TYPE_CONFIG[t].label}`
                }))}
                value={type}
                onChange={(value) => setType(value as TaskType)}
              />
            </div>

            <div className="task-form-group">
              <label className="task-form-label">
                <span>Dependencies</span>
                {dependsOn.length > 0 && (
                  <Badge variant="gray" size="small">{dependsOn.length} selected</Badge>
                )}
              </label>
              {availableTasks.length === 0 ? (
                <div className="task-form-no-data">No other tasks available</div>
              ) : (
                <div className="task-form-dependencies">
                  {availableTasks.length > 3 && (
                    <div className="task-form-dependencies-filter">
                      <Input
                        type="text"
                        placeholder="Filter tasks..."
                        value={dependencyFilter}
                        onChange={(value) => setDependencyFilter(value)}
                      />
                    </div>
                  )}
                  <div className="task-form-dependencies-list">
                    {availableTasks
                      .filter(
                        (t) =>
                          dependencyFilter === "" ||
                          t.title
                            .toLowerCase()
                            .includes(dependencyFilter.toLowerCase())
                      )
                      .map((t) => (
                        <label key={t.id} className="task-form-dependency-item">
                          <Checkbox
                            label=""
                            checked={dependsOn.includes(t.id)}
                            onChange={() => toggleDependency(t.id)}
                          />
                          <span className="task-form-dependency-title">{t.title}</span>
                          <span className="task-form-dependency-status">
                            {STATUS_CONFIG[t.status as Status].label}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="task-form-section task-form-section-scrollable">
            {/* Acceptance Criteria */}
            <div className="task-form-group">
              <label className="task-form-label">
                <span>Acceptance Criteria</span>
                {acceptanceCriteria.length > 0 && (
                  <Badge variant="gray" size="small">{acceptanceCriteria.length}</Badge>
                )}
              </label>
              <span className="task-form-helper">
                Observable outcomes to verify task completion
              </span>
              <div className="task-form-list">
                {acceptanceCriteria.map((criterion, index) => (
                  <div key={index} className="task-form-list-item">
                    <span className="task-form-list-item-content">{criterion}</span>
                    <button
                      type="button"
                      className="task-form-list-item-remove"
                      onClick={() => removeCriterion(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div className="task-form-add-row">
                  <Input
                    type="text"
                    placeholder="Add criterion..."
                    value={newCriterion}
                    onChange={(value) => setNewCriterion(value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCriterion())}
                  />
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={addCriterion}
                    disabled={newCriterion.trim() === ""}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Guardrails */}
            <div className="task-form-group">
              <label className="task-form-label">
                <span>Guardrails</span>
                {guardrails.length > 0 && (
                  <Badge variant="gray" size="small">{guardrails.length}</Badge>
                )}
              </label>
              <span className="task-form-helper">
                Numbered constraints (higher number = more critical)
              </span>
              <div className="task-form-list">
                {[...guardrails]
                  .sort((a, b) => b.number - a.number)
                  .map((guardrail) => (
                    <div key={guardrail.id} className="task-form-list-item">
                      <span className="task-form-badge-number">{guardrail.number}</span>
                      <span className="task-form-list-item-content">{guardrail.text}</span>
                      <button
                        type="button"
                        className="task-form-list-item-remove"
                        onClick={() => removeGuardrail(guardrail.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <div className="task-form-add-row">
                  <Input
                    type="number"
                    placeholder="999"
                    value={newGuardrailNumber}
                    onChange={(value) => setNewGuardrailNumber(value)}
                  />
                  <Input
                    type="text"
                    placeholder="Guardrail instruction..."
                    value={newGuardrailText}
                    onChange={(value) => setNewGuardrailText(value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuardrail())}
                  />
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={addGuardrail}
                    disabled={newGuardrailNumber === "" || parseInt(newGuardrailNumber) <= 0 || newGuardrailText.trim() === ""}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {isEdit && (
              <div className="task-form-group">
                <label className="task-form-label">
                  <span>Comments</span>
                  {comments.length > 0 && (
                    <Badge variant="gray" size="small">{comments.length}</Badge>
                  )}
                </label>
                <div className="task-form-comments">
                  {comments.length > 0 ? (
                    <>
                      {comments.map((comment) => (
                        <div key={comment.id} className="task-form-comment">
                          <div className="task-form-comment-header">
                            <div className="task-form-comment-meta">
                              <span
                                className={`task-form-comment-author ${
                                  comment.author === "mcp"
                                    ? "task-form-comment-author-mcp"
                                    : "task-form-comment-author-user"
                                }`}
                              >
                                {comment.author === "mcp" ? "MCP" : "User"}
                              </span>
                              <span className="task-form-comment-date">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="small"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={commentSubmitting}
                            >
                              Delete
                            </Button>
                          </div>
                          <p className="task-form-comment-body">{comment.body}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="task-form-no-data">No comments yet</div>
                  )}
                  <div className="task-form-add-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <Textarea
                      placeholder="Add a comment..."
                      value={commentBody}
                      onChange={(value) => setCommentBody(value)}
                      rows={2}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => void handleAddComment()}
                        disabled={commentBody.trim() === "" || commentSubmitting}
                      >
                        {commentSubmitting ? "..." : "Add Comment"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="task-form-footer">
          {isEdit && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={submitting}
              className="task-form-footer-delete"
              style={{ color: '#ef4444' }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={title.trim() === "" || submitting}
          >
            {submitting ? "..." : isEdit ? "Save" : "Create"}
          </Button>
        </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Task?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={() => void handleDeleteConfirmed()}
        onClose={() => {
          if (!submitting) setDeleteConfirmOpen(false);
        }}
        isLoading={submitting}
      />
      <ConfirmModal
        isOpen={deleteCommentId !== null}
        title="Delete Comment?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={() => void handleDeleteCommentConfirmed()}
        onClose={() => {
          if (!commentSubmitting) setDeleteCommentId(null);
        }}
        isLoading={commentSubmitting}
      />
    </>
  );
}
