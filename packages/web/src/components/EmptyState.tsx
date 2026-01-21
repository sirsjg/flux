import { ComponentChildren } from 'preact'
import {
  InboxIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'
import { Button } from './Button'
import './EmptyState.css'

type IconComponent = typeof InboxIcon

export interface EmptyStateProps {
  icon?: IconComponent
  iconSize?: 'sm' | 'md' | 'lg'
  title?: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  children?: ComponentChildren
  className?: string
}

export function EmptyState({
  icon: Icon = InboxIcon,
  iconSize = 'md',
  title,
  message,
  action,
  secondaryAction,
  children,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <div className={`empty-state-icon empty-state-icon-${iconSize}`}>
        <Icon />
      </div>
      {title !== undefined && title !== "" && <h3 className="empty-state-title">{title}</h3>}
      <p className="empty-state-message">{message}</p>
      {(action !== undefined || secondaryAction !== undefined || children !== undefined) && (
        <div className="empty-state-actions">
          {action !== undefined && (
            <Button variant="primary" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction !== undefined && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  )
}

export interface EmptyColumnProps {
  message: string
  hint?: string
  onClick?: () => void
}

export function EmptyColumn({ message, hint, onClick }: EmptyColumnProps) {
  return (
    <div className="empty-column" onClick={onClick} style={{ cursor: onClick !== undefined ? 'pointer' : 'default' }}>
      <div className="empty-column-icon">
        <PlusCircleIcon />
      </div>
      <div className="empty-column-message">{message}</div>
      {hint !== undefined && hint !== "" && <div className="empty-column-hint">{hint}</div>}
    </div>
  )
}

export interface EmptyBoardProps {
  title?: string
  message: string
  onCreateTask?: () => void
  onCreateEpic?: () => void
}

export function EmptyBoard({
  title = 'No tasks yet',
  message,
  onCreateTask,
  onCreateEpic,
}: EmptyBoardProps) {
  return (
    <div className="empty-board">
      <div className="empty-board-illustration">
        <FolderIcon style={{ width: '100%', height: '100%', color: 'var(--text-low)' }} />
      </div>
      <h2 className="empty-board-title">{title}</h2>
      <p className="empty-board-message">{message}</p>
      <div className="empty-state-actions">
        {onCreateTask !== undefined && (
          <Button variant="primary" onClick={onCreateTask}>
            <PlusCircleIcon style={{ width: '16px', height: '16px' }} />
            Create your first task
          </Button>
        )}
        {onCreateEpic !== undefined && (
          <Button variant="secondary" onClick={onCreateEpic}>
            Create an epic
          </Button>
        )}
      </div>
    </div>
  )
}

export interface EmptySearchProps {
  query: string
  suggestions?: string[]
  onClear?: () => void
}

export function EmptySearch({ query, suggestions, onClear }: EmptySearchProps) {
  return (
    <div className="empty-search">
      <div className="empty-search-icon">
        <MagnifyingGlassIcon />
      </div>
      <h3 className="empty-search-title">No results found for "{query}"</h3>
      <p className="empty-search-message">
        We couldn't find any tasks matching your search.
      </p>
      {suggestions !== undefined && suggestions.length > 0 && (
        <div className="empty-search-suggestions">
          <strong style={{ fontSize: '13px', color: 'var(--text-high)', marginBottom: '8px', display: 'block' }}>
            Try:
          </strong>
          <ul>
            {suggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      {onClear !== undefined && (
        <div style={{ marginTop: '24px' }}>
          <Button variant="secondary" onClick={onClear}>
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}
