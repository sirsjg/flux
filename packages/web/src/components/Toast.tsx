import { createContext, type ComponentChildren } from 'preact'
import type { JSX } from 'preact'
import { useContext, useState, useCallback } from 'preact/hooks'
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import './Toast.css'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  id: string
  variant: ToastVariant
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === null) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function Toast({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const icons = {
    success: CheckCircleIcon,
    error: XCircleIcon,
    info: InformationCircleIcon,
    warning: ExclamationTriangleIcon,
  }

  const Icon = icons[toast.variant]

  return (
    <div className={`toast toast-${toast.variant}`}>
      <div className="toast-icon">
        <Icon />
      </div>
      <div className="toast-content">
        <div className="toast-message">{toast.message}</div>
        {toast.action !== undefined && (
          <div className="toast-actions">
            <button className="toast-action" onClick={toast.action.onClick}>
              {toast.action.label}
            </button>
          </div>
        )}
      </div>
      <button className="toast-close" onClick={onClose} aria-label="Close">
        <XMarkIcon />
      </button>
      <div className="toast-progress">
        <div className="toast-progress-bar" />
      </div>
    </div>
  )
}

export function ToastProvider({ children }: { children: ComponentChildren }): JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const duration = toast.duration ?? 4000
    const newToast: ToastMessage = { ...toast, id }

    setToasts((prev) => [...prev, newToast])

    // Auto dismiss
    setTimeout(() => {
      hideToast(id)
    }, duration)
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
