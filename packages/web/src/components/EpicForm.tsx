import { useState, useEffect } from 'preact/hooks'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'
import { PRDEditor } from './PRDEditor'
import { createEpic, updateEpic, deleteEpic, getEpics, getEpicPRD, updateEpicPRD, deleteEpicPRD } from '../stores'
import type { Epic, Status, PRD } from '@flux/shared'
import { STATUSES, STATUS_CONFIG } from '@flux/shared'

interface EpicFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => Promise<void>
  epic?: Epic
  projectId: string
}

type Tab = 'basic' | 'prd'

export function EpicForm({ isOpen, onClose, onSave, epic, projectId }: EpicFormProps) {
  const [tab, setTab] = useState<Tab>('basic')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<string>('todo')
  const [dependsOn, setDependsOn] = useState<string[]>([])
  const [auto, setAuto] = useState(false)
  const [availableEpics, setAvailableEpics] = useState<Epic[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // PRD state
  const [prd, setPrd] = useState<PRD | null>(null)
  const [prdLoading, setPrdLoading] = useState(false)

  const isEdit = !!epic

  useEffect(() => {
    if (isOpen) {
      loadFormData()
      setTab('basic')
    } else {
      setDeleteConfirmOpen(false)
      setPrd(null)
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
      setAuto(epic.auto ?? false)
      // Load PRD if editing
      setPrdLoading(true)
      try {
        const epicPrd = await getEpicPRD(epic.id)
        setPrd(epicPrd)
      } finally {
        setPrdLoading(false)
      }
    } else {
      setTitle('')
      setNotes('')
      setStatus('todo')
      setDependsOn([])
      setAuto(false)
      setPrd(null)
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
          auto,
        })
      } else {
        const newEpic = await createEpic(projectId, title.trim(), notes.trim())
        if (dependsOn.length > 0 || auto) {
          await updateEpic(newEpic.id, { depends_on: dependsOn, auto })
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

  const handlePrdSave = async (updatedPrd: PRD) => {
    if (!epic) return
    setSubmitting(true)
    try {
      await updateEpicPRD(epic.id, updatedPrd)
      setPrd(updatedPrd)
      await onSave()
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrdDelete = async () => {
    if (!epic) return
    setSubmitting(true)
    try {
      await deleteEpicPRD(epic.id)
      setPrd(null)
      await onSave()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? `Edit Epic: ${epic?.title}` : 'New Epic'} wide={tab === 'prd'}>
        {isEdit && (
          <div class="tabs tabs-boxed mb-4">
            <button
              type="button"
              class={`tab ${tab === 'basic' ? 'tab-active' : ''}`}
              onClick={() => setTab('basic')}
            >
              Basic
            </button>
            <button
              type="button"
              class={`tab ${tab === 'prd' ? 'tab-active' : ''}`}
              onClick={() => setTab('prd')}
            >
              PRD
            </button>
          </div>
        )}

        {tab === 'basic' ? (
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

            <div class="form-control mb-4">
              <label class="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  class="checkbox checkbox-primary"
                  checked={auto}
                  onChange={(e) => setAuto((e.target as HTMLInputElement).checked)}
                />
                <span class="label-text">Auto-execute tasks (headless agent mode)</span>
              </label>
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
        ) : (
          <PRDEditor
            prd={prd}
            loading={prdLoading}
            saving={submitting}
            onSave={handlePrdSave}
            onDelete={handlePrdDelete}
            onClose={onClose}
          />
        )}
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
