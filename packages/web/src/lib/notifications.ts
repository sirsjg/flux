/**
 * Browser notifications for board changes, driven by SSE `change` events.
 * Opt-in per browser via localStorage + the Notification permission.
 */

export type ChangeEvent = {
  event: string
  project_id?: string
  project_name?: string
  title?: string
  status?: string
}

const PREF_KEY = 'flux_notifications'

export function isSupported(): boolean {
  return typeof Notification !== 'undefined'
}

export function isEnabled(): boolean {
  if (!isSupported() || Notification.permission !== 'granted') return false
  try {
    return localStorage.getItem(PREF_KEY) === 'on'
  } catch {
    return false
  }
}

export async function enable(): Promise<boolean> {
  if (!isSupported()) return false
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false
  try {
    localStorage.setItem(PREF_KEY, 'on')
  } catch {
    return false
  }
  return true
}

export function disable(): void {
  try {
    localStorage.setItem(PREF_KEY, 'off')
  } catch {
    // Ignore
  }
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'Planning',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

/**
 * Show a notification for a change event. Only fires when notifications are
 * enabled and the tab is in the background (changes you make yourself while
 * looking at the board stay silent).
 */
export function notifyChange(change: ChangeEvent): void {
  if (!isEnabled() || !document.hidden) return

  let body: string | null = null
  switch (change.event) {
    case 'task.created':
      body = change.title ? `New task: ${change.title}` : 'New task created'
      break
    case 'task.status_changed': {
      const status = STATUS_LABELS[change.status ?? ''] ?? change.status
      body = change.title && status ? `${change.title} → ${status}` : null
      break
    }
    case 'task.deleted':
      body = change.title ? `Task deleted: ${change.title}` : null
      break
    default:
      return
  }
  if (!body) return

  const title = change.project_name ? `Flux · ${change.project_name}` : 'Flux'
  const notification = new Notification(title, { body, tag: `flux-${change.project_id ?? 'global'}` })
  notification.onclick = () => {
    window.focus()
    notification.close()
  }
}
