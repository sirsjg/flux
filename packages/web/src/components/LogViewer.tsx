import type { JSX } from 'preact'
import { ComponentChildren } from 'preact'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  EyeIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import './LogViewer.css'

export type LogType = 'analysis' | 'todo' | 'info' | 'warning' | 'error'
export type LogCheckStatus = 'viewing' | 'completed' | null

export interface LogEntry {
  id: string
  type: LogType
  title: string
  details?: string
  filepath?: string
  timestamp?: string
  checkStatus?: LogCheckStatus
  badge?: string
  children?: ComponentChildren
}

export interface LogItemProps {
  log: LogEntry
}

export function LogItem({ log }: LogItemProps): JSX.Element {
  const iconMap = {
    analysis: MagnifyingGlassIcon,
    todo: SparklesIcon,
    info: InformationCircleIcon,
    warning: ExclamationTriangleIcon,
    error: XCircleIcon,
  }

  const Icon = iconMap[log.type]
  const iconClass = `log-icon log-icon-${log.type}`

  return (
    <div className="log-item">
      <div className={iconClass}>
        <Icon style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="log-content">
        <div className="log-title">{log.title}</div>
        {log.details !== undefined && log.details !== "" && <div className="log-details">{log.details}</div>}
        {log.filepath !== undefined && log.filepath !== "" && <code className="log-filepath">{log.filepath}</code>}
        {(log.timestamp !== undefined || log.checkStatus !== undefined || log.badge !== undefined) && (
          <div className="log-meta">
            {log.checkStatus !== undefined && log.checkStatus !== null && (
              <span className={`log-check-icon log-check-${log.checkStatus}`}>
                {log.checkStatus === 'viewing' ? (
                  <EyeIcon style={{ width: '100%', height: '100%' }} />
                ) : (
                  <CheckCircleIcon style={{ width: '100%', height: '100%' }} />
                )}
              </span>
            )}
            {log.timestamp !== undefined && log.timestamp !== "" && <span className="log-timestamp">{log.timestamp}</span>}
            {log.badge !== undefined && log.badge !== "" && <span className="log-badge">{log.badge}</span>}
          </div>
        )}
        {log.children}
      </div>
    </div>
  )
}

export interface LogViewerProps {
  logs: LogEntry[]
  className?: string
}

export function LogViewer({ logs, className = '' }: LogViewerProps): JSX.Element {
  return (
    <div className={`log-viewer ${className}`}>
      {logs.map((log) => (
        <LogItem key={log.id} log={log} />
      ))}
    </div>
  )
}
