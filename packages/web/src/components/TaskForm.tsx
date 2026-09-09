import { useState, useEffect } from "preact/hooks";
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  PaperClipIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { ConfirmModal } from "./ConfirmModal";
import { Modal } from "./Modal";
import { CollapsibleSection } from "./CollapsibleSection";
import { Select } from "./Select";
import {
  createTask,
  updateTask,
  deleteTask,
  addTaskComment,
  deleteTaskComment,
  getEpics,
  getTasks,
  uploadBlob,
  getBlobs,
  deleteBlob,
  getBlobContentUrl,
  type TaskWithBlocked,
} from "../stores";
import type { Task, Epic, Status, TaskComment, Guardrail, Blob as FluxBlob } from "@flux/shared";
import { STATUSES, STATUS_CONFIG } from "@flux/shared";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [blobs, setBlobs] = useState<FluxBlob[]>([]);
  const [uploading, setUploading] = useState(false);

  const isEdit = !!task;

  useEffect(() => {
    if (isOpen) {
      setDeleteConfirmOpen(false);
      setDeleteCommentId(null);
      loadFormData();
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
      task ? tasksData.filter((t) => t.id !== task.id) : tasksData
    );

    setDependencyFilter("");
    setNewCriterion("");
    setNewGuardrailNumber("");
    setNewGuardrailText("");
    if (task) {
      setTitle(task.title);
      setStatus(task.status);
      setEpicId(task.epic_id || "");
      setDependsOn([...task.depends_on]);
      setComments(task.comments ? [...task.comments] : []);
      setBlockedReason(task.blocked_reason || "");
      setAcceptanceCriteria(task.acceptance_criteria ? [...task.acceptance_criteria] : []);
      setGuardrails(task.guardrails ? [...task.guardrails] : []);
      const blobsData = await getBlobs(task.id);
      setBlobs(blobsData);
    } else {
      setTitle("");
      setStatus("todo");
      setEpicId(defaultEpicId || "");
      setDependsOn([]);
      setComments([]);
      setBlockedReason("");
      setAcceptanceCriteria([]);
      setGuardrails([]);
      setBlobs([]);
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
          status,
          epic_id: epicId || undefined,
          depends_on: dependsOn,
          blocked_reason: blockedReason.trim() || undefined,
          acceptance_criteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
          guardrails: guardrails.length > 0 ? guardrails : undefined,
        });
      } else {
        const newTask = await createTask(
          projectId,
          title.trim(),
          epicId || undefined
        );
        const updates: Partial<Task> = {};
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

  const handleDelete = () => {
    if (task && !submitting) {
      setDeleteConfirmOpen(true);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!task || submitting) return;
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

  const handleAddComment = async () => {
    if (!task || !commentBody.trim() || commentSubmitting) return;
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

  const handleDeleteComment = async (commentId: string) => {
    if (!task || commentSubmitting) return;
    setDeleteCommentId(commentId);
  };

  const handleDeleteCommentConfirmed = async () => {
    if (!task || commentSubmitting || !deleteCommentId) return;
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

  const toggleDependency = (taskId: string) => {
    setDependsOn((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setAcceptanceCriteria((prev) => [...prev, newCriterion.trim()]);
    setNewCriterion("");
  };

  const removeCriterion = (index: number) => {
    setAcceptanceCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const addGuardrail = () => {
    const num = Math.floor(parseInt(newGuardrailNumber));
    if (isNaN(num) || num <= 0 || !newGuardrailText.trim()) return;
    setGuardrails((prev) => [...prev, { id: crypto.randomUUID(), number: num, text: newGuardrailText.trim() }]);
    setNewGuardrailNumber("");
    setNewGuardrailText("");
  };

  const removeGuardrail = (id: string) => {
    setGuardrails((prev) => prev.filter((g) => g.id !== id));
  };

  const handleFileUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !task || uploading) return;
    setUploading(true);
    try {
      const blob = await uploadBlob(file, task.id);
      setBlobs((prev) => [...prev, blob]);
      await onSave();
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handleDeleteBlob = async (blobId: string) => {
    await deleteBlob(blobId);
    setBlobs((prev) => prev.filter((b) => b.id !== blobId));
    await onSave();
  };

  // Default-open state comes from the task prop (available synchronously),
  // keyed by task id so sections reset when a different task is opened.
  const sectionKey = task?.id ?? "new";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Task" : "New Task"}
        subtitle={isEdit ? task?.title : undefined}
        size="xl"
      >
        <form onSubmit={handleSubmit}>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
          <div>
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

            {isEdit && (
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">Status</span>
                </label>
                <Select
                  ariaLabel="Status"
                  value={status}
                  onChange={setStatus}
                  options={STATUSES.map((s) => ({
                    value: s,
                    label: STATUS_CONFIG[s].label,
                  }))}
                />
              </div>
            )}

            {isEdit && (
              <div class="form-control mb-4">
                <label class="label">
                  <span class="label-text">External Blocker</span>
                  {blockedReason && (
                    <span class="badge badge-warning badge-sm">Blocked</span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="e.g., Waiting for vendor quote"
                  class="input input-bordered w-full"
                  value={blockedReason}
                  onInput={(e) => setBlockedReason((e.target as HTMLInputElement).value)}
                />
                <label class="label">
                  <span class="label-text-alt text-base-content/50">
                    Set to block task on external process. Clear to unblock.
                  </span>
                </label>
              </div>
            )}

            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">Epic</span>
              </label>
              <Select
                ariaLabel="Epic"
                value={epicId}
                onChange={setEpicId}
                options={[
                  { value: "", label: "Unassigned" },
                  ...epics.map((epic) => ({
                    value: epic.id,
                    label: epic.title,
                  })),
                ]}
              />
            </div>

            <div class="form-control mb-6">
              <label class="label">
                <span class="label-text">Dependencies</span>
                {dependsOn.length > 0 && (
                  <span class="label-text-alt">{dependsOn.length} selected</span>
                )}
              </label>
              {availableTasks.length === 0 ? (
                <p class="text-sm text-base-content/50">
                  No other tasks available
                </p>
              ) : (
                <div class="border border-base-300 rounded-xl overflow-hidden">
                  {availableTasks.length > 3 && (
                    <div class="px-3 py-2 border-b border-base-300 bg-base-200/50">
                      <input
                        type="text"
                        placeholder="Search tasks..."
                        class="input input-bordered input-sm w-full"
                        value={dependencyFilter}
                        onInput={(e) =>
                          setDependencyFilter(
                            (e.target as HTMLInputElement).value
                          )
                        }
                      />
                    </div>
                  )}
                  <div class="max-h-48 overflow-y-auto">
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
                            {STATUS_CONFIG[t.status as Status]?.label ||
                              t.status}
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <CollapsibleSection
              key={`ac-${sectionKey}`}
              title="Acceptance Criteria"
              hint="Observable outcomes"
              count={acceptanceCriteria.length}
              icon={<CheckCircleIcon className="h-4 w-4 text-success/70" />}
              defaultOpen={(task?.acceptance_criteria?.length ?? 0) > 0}
            >
              <p class="text-xs text-base-content/50 mb-2">
                Observable outcomes to verify task completion
              </p>
              <div class="space-y-2">
                {acceptanceCriteria.map((criterion, index) => (
                  <div
                    key={index}
                    class="flex items-start gap-2 bg-base-200/60 rounded-lg px-3 py-2"
                  >
                    <span class="text-sm flex-1">{criterion}</span>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      aria-label="Remove criterion"
                      onClick={() => removeCriterion(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <div class="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add criterion..."
                    class="input input-bordered input-sm min-w-0 flex-1"
                    value={newCriterion}
                    onInput={(e) => setNewCriterion((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCriterion())}
                  />
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    onClick={addCriterion}
                    disabled={!newCriterion.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              key={`gr-${sectionKey}`}
              title="Guardrails"
              hint="Constraints for agents"
              count={guardrails.length}
              icon={<ShieldCheckIcon className="h-4 w-4 text-info/70" />}
              defaultOpen={(task?.guardrails?.length ?? 0) > 0}
            >
              <p class="text-xs text-base-content/50 mb-2">
                Numbered constraints (higher number = more critical)
              </p>
              <div class="space-y-2">
                {[...guardrails]
                  .sort((a, b) => b.number - a.number)
                  .map((guardrail) => (
                    <div
                      key={guardrail.id}
                      class="flex items-start gap-2.5 bg-base-200/60 rounded-lg px-3 py-2"
                    >
                      <span class="inline-flex items-center gap-1 rounded-full bg-info/10 text-info border border-info/25 px-2 py-0.5 text-xs font-mono font-semibold flex-shrink-0">
                        <ShieldCheckIcon className="h-3 w-3" />
                        {guardrail.number}
                      </span>
                      <span class="text-sm flex-1">{guardrail.text}</span>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        aria-label="Remove guardrail"
                        onClick={() => removeGuardrail(guardrail.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <div class="guardrail-inputs flex gap-2">
                  <input
                    type="number"
                    placeholder="999"
                    class="input input-bordered input-sm w-20"
                    value={newGuardrailNumber}
                    onInput={(e) => setNewGuardrailNumber((e.target as HTMLInputElement).value)}
                  />
                  <input
                    type="text"
                    placeholder="Guardrail instruction..."
                    class="input input-bordered input-sm min-w-0 flex-1"
                    value={newGuardrailText}
                    onInput={(e) => setNewGuardrailText((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGuardrail())}
                  />
                  <button
                    type="button"
                    class="btn btn-sm btn-outline"
                    onClick={addGuardrail}
                    disabled={!newGuardrailNumber || parseInt(newGuardrailNumber) <= 0 || !newGuardrailText.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </CollapsibleSection>

            {isEdit && (
              <CollapsibleSection
                key={`at-${sectionKey}`}
                title="Attachments"
                hint="Files and images"
                count={blobs.length}
                icon={<PaperClipIcon className="h-4 w-4 text-base-content/50" />}
                defaultOpen={(task?.blob_ids?.length ?? 0) > 0}
              >
                <div class="space-y-2">
                  {blobs.map((blob) => (
                    <div
                      key={blob.id}
                      class="flex items-center gap-2 bg-base-200/60 rounded-lg px-3 py-2"
                    >
                      {blob.mime_type.startsWith("image/") ? (
                        <img
                          src={getBlobContentUrl(blob.id)}
                          alt={blob.filename}
                          class="w-10 h-10 object-cover rounded-lg"
                        />
                      ) : (
                        <PaperClipIcon className="h-5 w-5 text-base-content/50 flex-shrink-0" />
                      )}
                      <div class="flex-1 min-w-0">
                        <a
                          href={getBlobContentUrl(blob.id)}
                          target="_blank"
                          class="text-sm font-medium truncate block hover:underline"
                        >
                          {blob.filename}
                        </a>
                        <span class="text-xs text-base-content/50">
                          {formatFileSize(blob.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        aria-label="Remove attachment"
                        onClick={() => handleDeleteBlob(blob.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label class="btn btn-sm btn-outline gap-2 cursor-pointer">
                    {uploading ? (
                      <span class="loading loading-spinner loading-xs" />
                    ) : (
                      <>
                        <PaperClipIcon className="h-4 w-4" />
                        Attach file
                      </>
                    )}
                    <input
                      type="file"
                      class="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </CollapsibleSection>
            )}

            {isEdit && (
              <CollapsibleSection
                key={`cm-${sectionKey}`}
                title="Comments"
                hint="Agent memory and notes"
                count={comments.length}
                icon={<ChatBubbleLeftRightIcon className="h-4 w-4 text-base-content/50" />}
                defaultOpen
              >
                <div class="space-y-3">
                  {comments.length > 0 ? (
                    <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          class="bg-base-200/60 rounded-lg p-3 text-sm"
                        >
                          <div class="flex items-center justify-between gap-2 mb-2">
                            <div class="flex items-center gap-2 min-w-0">
                              <span
                                class={`badge badge-sm flex-shrink-0 ${
                                  comment.author === "mcp"
                                    ? "badge-secondary"
                                    : "badge-ghost"
                                }`}
                              >
                                {comment.author === "mcp" ? "MCP" : "User"}
                              </span>
                              {comment.agent_name && (
                                <span
                                  class="worker-chip"
                                  title={comment.agent_name}
                                >
                                  <span class="worker-chip-name">
                                    {comment.agent_name}
                                  </span>
                                </span>
                              )}
                              {comment.created_at && (
                                <span class="text-xs text-base-content/50 truncate">
                                  {new Date(
                                    comment.created_at
                                  ).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs flex-shrink-0"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={commentSubmitting}
                            >
                              Delete
                            </button>
                          </div>
                          <p class="text-sm whitespace-pre-wrap">
                            {comment.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p class="text-sm text-base-content/50">No comments yet</p>
                  )}
                  <div class="flex flex-col gap-2">
                    <textarea
                      placeholder="Add a comment..."
                      class="textarea textarea-bordered w-full"
                      value={commentBody}
                      onInput={(e) =>
                        setCommentBody((e.target as HTMLTextAreaElement).value)
                      }
                      rows={2}
                    />
                    <div class="flex justify-end">
                      <button
                        type="button"
                        class="btn btn-sm btn-outline"
                        onClick={handleAddComment}
                        disabled={!commentBody.trim() || commentSubmitting}
                      >
                        {commentSubmitting ? (
                          <span class="loading loading-spinner loading-xs"></span>
                        ) : (
                          "Add Comment"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        </div>

        <div class="task-form-actions modal-action sticky bottom-0 -mx-6 -mb-5 mt-6 px-6 py-4 bg-base-100 border-t border-base-200">
          {isEdit && (
            <button
              type="button"
              class="btn btn-ghost text-error"
              onClick={handleDelete}
              disabled={submitting}
            >
              Delete
            </button>
          )}
          <div class="flex-1" />
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
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Task?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={handleDeleteConfirmed}
        onClose={() => {
          if (!submitting) setDeleteConfirmOpen(false);
        }}
        isLoading={submitting}
      />
      <ConfirmModal
        isOpen={!!deleteCommentId}
        title="Delete Comment?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={handleDeleteCommentConfirmed}
        onClose={() => {
          if (!commentSubmitting) setDeleteCommentId(null);
        }}
        isLoading={commentSubmitting}
      />
    </>
  );
}
