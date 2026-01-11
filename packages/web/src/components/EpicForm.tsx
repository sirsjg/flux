import { useState, useEffect } from 'preact/hooks'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { createEpic, updateEpic, deleteEpic, getEpics } from '../stores'
import type { Epic, Status } from '@flux/shared'
import { STATUSES, STATUS_CONFIG } from '@flux/shared'

interface EpicFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  epic?: Epic // If provided, edit mode; otherwise create mode
  projectId: string
}

export function EpicForm({ isOpen, onClose, onSave, epic, projectId }: EpicFormProps) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string>('todo')
  const [dependsOn, setDependsOn] = useState<string[]>([])
  const [availableEpics, setAvailableEpics] = useState<Epic[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const isEdit = !!epic

  useEffect(() => {
    if (isOpen) {
      loadFormData()
    } else {
      setDeleteConfirmOpen(false)
    }
  }, [isOpen, epic, projectId])

  const loadFormData = async () => {
    const allEpics = await getEpics(projectId)
    setAvailableEpics(epic ? allEpics.filter(e => e.id !== epic.id) : allEpics)
    if (epic) {
      setTitle(epic.title)
      setNotes(epic.notes)
      setStatus(epic.status)
      setDependsOn([...epic.depends_on])
    } else {
      setTitle('')
      setNotes('')
      setStatus('todo')
      setDependsOn([])
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!title.trim() || submitting) return

    setSubmitting(true)
    try {
      if (isEdit && epic) {
        await updateEpic(epic.id, {
          title: title.trim(),
          notes: notes.trim(),
          status,
          depends_on: dependsOn,
        })
      } else {
        const newEpic = await createEpic(projectId, title.trim(), notes.trim())
        if (dependsOn.length > 0) {
          await updateEpic(newEpic.id, { depends_on: dependsOn })
        }
      }
      await onSave()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = () => {
    if (epic && !submitting) {
      setDeleteConfirmOpen(true)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!epic || submitting) return
    setSubmitting(true)
    try {
      await deleteEpic(epic.id)
      await onSave()
      onClose()
    } finally {
      setSubmitting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const toggleDependency = (epicId: string) => {
    setDependsOn(prev =>
      prev.includes(epicId)
        ? prev.filter(id => id !== epicId)
        : [...prev, epicId]
    )
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Epic' : 'New Epic'}>
        <form onSubmit={handleSubmit}>
        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Title *</span>
          </label>
          <input
            type="text"
            placeholder="Epic title"
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

        <div class="form-control mb-4">
          <label class="label">
            <span class="label-text">Status</span>
          </label>
          <select
            class="select select-bordered w-full"
            value={status}
            onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}
          >
            {STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
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
          {availableEpics.length === 0 ? (
            <p class="text-sm text-base-content/50">No other epics available</p>
          ) : (
            <div class="border border-base-300 rounded-lg max-h-32 overflow-y-auto">
              {availableEpics.map(e => (
                <label key={e.id} class="flex items-center gap-2 px-3 py-2 hover:bg-base-200 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={dependsOn.includes(e.id)}
                    onChange={() => toggleDependency(e.id)}
                  />
                  <span class="text-sm truncate flex-1">{e.title}</span>
                  <span class="badge badge-ghost badge-xs">{STATUS_CONFIG[e.status as Status]?.label || e.status}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div class="modal-action">
          {isEdit && (
            <button type="button" class="btn btn-error btn-outline" onClick={handleDelete} disabled={submitting}>
              Delete
            </button>
          )}
          <button type="button" class="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" disabled={!title.trim() || submitting}>
            {submitting ? <span class="loading loading-spinner loading-sm"></span> : (isEdit ? 'Save' : 'Create')}
          </button>
        </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Epic?"
        description="Tasks in this epic will be moved to Unassigned."
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={handleDeleteConfirmed}
        onClose={() => {
          if (!submitting) setDeleteConfirmOpen(false)
        }}
        isLoading={submitting}
      />
    </>
  )
}
