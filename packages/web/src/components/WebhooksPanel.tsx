import {
  CheckIcon,
  NoSymbolIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useState } from 'preact/hooks'
import type { Webhook, WebhookDelivery, WebhookEventType } from '@flux/shared'
import { WEBHOOK_EVENT_TYPES, WEBHOOK_EVENT_LABELS } from '@flux/shared'
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  getProjects,
  type ProjectWithStats,
} from '../stores/api'
import { ConfirmModal } from './ConfirmModal'
import { Modal } from './Modal'

export function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [showDeliveries, setShowDeliveries] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [testResult, setTestResult] = useState<{ webhookId: string; result: any } | null>(null)
  const [pendingDeleteWebhook, setPendingDeleteWebhook] = useState<Webhook | null>(null)
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([])
  const [formSecret, setFormSecret] = useState('')
  const [formProjectId, setFormProjectId] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [webhooksData, projectsData] = await Promise.all([
      getWebhooks(),
      getProjects(),
    ])
    setWebhooks(webhooksData)
    setProjects(projectsData)
    setLoading(false)
  }

  function openCreateForm() {
    setEditingWebhook(null)
    setFormName('')
    setFormUrl('')
    setFormEvents([])
    setFormSecret('')
    setFormProjectId('')
    setFormEnabled(true)
    setShowForm(true)
  }

  function openEditForm(webhook: Webhook) {
    setEditingWebhook(webhook)
    setFormName(webhook.name)
    setFormUrl(webhook.url)
    setFormEvents([...webhook.events])
    setFormSecret(webhook.secret || '')
    setFormProjectId(webhook.project_id || '')
    setFormEnabled(webhook.enabled)
    setShowForm(true)
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!formName || !formUrl || formEvents.length === 0) return

    if (editingWebhook) {
      await updateWebhook(editingWebhook.id, {
        name: formName,
        url: formUrl,
        events: formEvents,
        secret: formSecret || undefined,
        project_id: formProjectId || undefined,
        enabled: formEnabled,
      })
    } else {
      await createWebhook(formName, formUrl, formEvents, {
        secret: formSecret || undefined,
        project_id: formProjectId || undefined,
        enabled: formEnabled,
      })
    }

    setShowForm(false)
    loadData()
  }

  function handleDelete(webhook: Webhook) {
    setPendingDeleteWebhook(webhook)
  }

  async function handleDeleteConfirmed() {
    if (!pendingDeleteWebhook || deletingWebhookId) return
    setDeletingWebhookId(pendingDeleteWebhook.id)
    try {
      await deleteWebhook(pendingDeleteWebhook.id)
      loadData()
    } finally {
      setDeletingWebhookId(null)
      setPendingDeleteWebhook(null)
    }
  }

  async function handleToggleEnabled(webhook: Webhook) {
    await updateWebhook(webhook.id, { enabled: !webhook.enabled })
    loadData()
  }

  async function handleTest(webhook: Webhook) {
    setTestResult({ webhookId: webhook.id, result: { loading: true } })
    const result = await testWebhook(webhook.id)
    setTestResult({ webhookId: webhook.id, result })
  }

  async function handleShowDeliveries(webhookId: string) {
    setShowDeliveries(webhookId)
    const data = await getWebhookDeliveries(webhookId, 20)
    setDeliveries(data)
  }

  function toggleEvent(event: WebhookEventType) {
    if (formEvents.includes(event)) {
      setFormEvents(formEvents.filter(e => e !== event))
    } else {
      setFormEvents([...formEvents, event])
    }
  }

  function selectAllEvents() {
    setFormEvents([...WEBHOOK_EVENT_TYPES])
  }

  function clearAllEvents() {
    setFormEvents([])
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-4">
        <div>
          <h4 class="text-lg font-semibold">Webhooks</h4>
          <p class="text-sm text-base-content/60">
            Send events to external services when changes happen.
          </p>
        </div>
        <button class="btn btn-primary btn-sm" onClick={openCreateForm}>
          + Add Webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div class="card bg-base-100 shadow-sm border border-base-200">
          <div class="card-body text-center py-10">
            <h2 class="text-lg font-semibold mb-2">No webhooks configured</h2>
            <p class="text-base-content/60 mb-4">
              Webhooks let you send notifications to external services when events occur in Flux.
            </p>
            <button class="btn btn-primary" onClick={openCreateForm}>
              Create your first webhook
            </button>
          </div>
        </div>
      ) : (
        <div class="space-y-4">
          {webhooks.map(webhook => (
            <div key={webhook.id} class="card bg-base-100 shadow-sm border border-base-200">
              <div class="card-body">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-3 mb-2">
                      <h2 class="card-title text-lg">{webhook.name}</h2>
                      <span class={`badge ${webhook.enabled ? 'badge-success' : 'badge-ghost'}`}>
                        {webhook.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {webhook.project_id && (
                        <span class="badge badge-outline badge-sm">
                          Project: {projects.find(p => p.id === webhook.project_id)?.name || webhook.project_id}
                        </span>
                      )}
                    </div>
                    <p class="text-sm text-base-content/60 font-mono break-all mb-2">{webhook.url}</p>
                    <div class="flex flex-wrap gap-1 mb-2">
                      {webhook.events.map(event => (
                        <span key={event} class="badge badge-sm badge-outline">
                          {WEBHOOK_EVENT_LABELS[event]}
                        </span>
                      ))}
                    </div>
                    <p class="text-xs text-base-content/40">
                      Created: {new Date(webhook.created_at).toLocaleDateString()}
                      {webhook.secret && ' | Secret configured'}
                    </p>
                  </div>
                  <div class="flex flex-col gap-2">
                    <div class="flex gap-1">
                      <button
                        class="btn btn-ghost btn-xs"
                        onClick={() => openEditForm(webhook)}
                        title="Edit"
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        class="btn btn-ghost btn-xs"
                        onClick={() => handleToggleEnabled(webhook)}
                        title={webhook.enabled ? 'Disable' : 'Enable'}
                      >
                        {webhook.enabled ? (
                          <NoSymbolIcon className="h-4 w-4" />
                        ) : (
                          <CheckIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        class="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(webhook)}
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      class="btn btn-outline btn-xs"
                      onClick={() => handleTest(webhook)}
                      disabled={testResult?.webhookId === webhook.id && testResult?.result?.loading}
                    >
                      {testResult?.webhookId === webhook.id && testResult?.result?.loading ? (
                        <span class="loading loading-spinner loading-xs"></span>
                      ) : (
                        'Test'
                      )}
                    </button>
                    <button
                      class="btn btn-outline btn-xs"
                      onClick={() => handleShowDeliveries(webhook.id)}
                    >
                      Deliveries
                    </button>
                  </div>
                </div>

                {testResult?.webhookId === webhook.id && !testResult?.result?.loading && (
                  <div class={`mt-3 p-3 rounded-lg ${testResult.result.success ? 'bg-success/10' : 'bg-error/10'}`}>
                    <div class="flex items-center gap-2 mb-1">
                      {testResult.result.success ? (
                        <span class="text-success font-medium">Test Successful</span>
                      ) : (
                        <span class="text-error font-medium">Test Failed</span>
                      )}
                      {testResult.result.status_code && (
                        <span class="badge badge-sm">HTTP {testResult.result.status_code}</span>
                      )}
                      <button class="btn btn-ghost btn-xs ml-auto" onClick={() => setTestResult(null)}>
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                    {testResult.result.error && (
                      <p class="text-sm text-error">{testResult.result.error}</p>
                    )}
                    {testResult.result.response && (
                      <pre class="text-xs mt-1 overflow-auto max-h-24">{testResult.result.response}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} title={editingWebhook ? 'Edit Webhook' : 'Create Webhook'} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSubmit} class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Name</span>
            </label>
            <input
              type="text"
              class="input input-bordered w-full"
              value={formName}
              onInput={(e) => setFormName((e.target as HTMLInputElement).value)}
              placeholder="My Webhook"
              required
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">URL</span>
            </label>
            <input
              type="url"
              class="input input-bordered w-full font-mono text-sm"
              value={formUrl}
              onInput={(e) => setFormUrl((e.target as HTMLInputElement).value)}
              placeholder="https://example.com/webhook"
              required
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Events</span>
              <span class="label-text-alt">
                <button type="button" class="link link-primary text-xs" onClick={selectAllEvents}>Select All</button>
                {' | '}
                <button type="button" class="link link-primary text-xs" onClick={clearAllEvents}>Clear</button>
              </span>
            </label>
            <div class="grid grid-cols-2 gap-2 p-3 border rounded-lg border-base-300 max-h-48 overflow-y-auto">
              {WEBHOOK_EVENT_TYPES.map(event => (
                <label key={event} class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    checked={formEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  <span class="text-sm">{WEBHOOK_EVENT_LABELS[event]}</span>
                </label>
              ))}
            </div>
            {formEvents.length === 0 && (
              <span class="text-xs text-error mt-1">Select at least one event</span>
            )}
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Secret (optional)</span>
              <span class="label-text-alt">For HMAC signature verification</span>
            </label>
            <input
              type="text"
              class="input input-bordered w-full font-mono text-sm"
              value={formSecret}
              onInput={(e) => setFormSecret((e.target as HTMLInputElement).value)}
              placeholder="your-secret-key"
            />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Project Filter (optional)</span>
              <span class="label-text-alt">Only trigger for this project</span>
            </label>
            <select
              class="select select-bordered w-full"
              value={formProjectId}
              onChange={(e) => setFormProjectId((e.target as HTMLSelectElement).value)}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div class="form-control">
            <label class="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                class="toggle toggle-primary"
                checked={formEnabled}
                onChange={(e) => setFormEnabled((e.target as HTMLInputElement).checked)}
              />
              <span class="label-text">Enabled</span>
            </label>
          </div>

          <div class="flex justify-end gap-2 pt-4">
            <button type="button" class="btn btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={formEvents.length === 0}>
              {editingWebhook ? 'Save Changes' : 'Create Webhook'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!showDeliveries}
        title="Recent Deliveries"
        onClose={() => setShowDeliveries(null)}
      >
        {deliveries.length === 0 ? (
          <p class="text-center py-8 text-base-content/60">No deliveries yet</p>
        ) : (
          <div class="space-y-3 max-h-96 overflow-y-auto">
            {deliveries.map(delivery => (
              <div
                key={delivery.id}
                class={`p-3 rounded-lg border ${
                  delivery.status === 'success'
                    ? 'border-success/30 bg-success/5'
                    : delivery.status === 'failed'
                    ? 'border-error/30 bg-error/5'
                    : 'border-warning/30 bg-warning/5'
                }`}
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="badge badge-sm">{WEBHOOK_EVENT_LABELS[delivery.event]}</span>
                  <span class={`badge badge-sm ${
                    delivery.status === 'success'
                      ? 'badge-success'
                      : delivery.status === 'failed'
                      ? 'badge-error'
                      : 'badge-warning'
                  }`}>
                    {delivery.status}
                  </span>
                </div>
                <div class="text-xs text-base-content/60">
                  <span>{new Date(delivery.created_at).toLocaleString()}</span>
                  {delivery.response_code && <span> | HTTP {delivery.response_code}</span>}
                  {delivery.attempts > 1 && <span> | {delivery.attempts} attempts</span>}
                </div>
                {delivery.error && (
                  <p class="text-xs text-error mt-1">{delivery.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!pendingDeleteWebhook}
        title="Delete Webhook?"
        description={
          pendingDeleteWebhook
            ? `Delete webhook "${pendingDeleteWebhook.name}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        confirmClassName="btn-error"
        onConfirm={handleDeleteConfirmed}
        onClose={() => {
          if (!deletingWebhookId) setPendingDeleteWebhook(null)
        }}
        isLoading={!!deletingWebhookId}
      />
    </div>
  )
}
