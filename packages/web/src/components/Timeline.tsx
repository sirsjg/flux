import type { JSX } from 'preact'
import { ComponentChildren } from 'preact'
import './Timeline.css'

export type TimelineNodeType = 'default' | 'start' | 'milestone' | 'cut' | 'info'

export interface TimelineItemProps {
  date: string
  title: string
  description?: string
  nodeType?: TimelineNodeType
  badge?: {
    label: string
    icon?: ComponentChildren
  }
  avatar?: string
  children?: ComponentChildren
}

export function TimelineItem({
  date,
  title,
  description,
  nodeType = 'default',
  badge,
  avatar,
  children,
}: TimelineItemProps): JSX.Element {
  const nodeClass = nodeType === 'default' ? 'timeline-node' : `timeline-node timeline-node-${nodeType}`

  return (
    <div className="timeline-item">
      <div className={nodeClass} />
      <div className="timeline-content">
        <div className="timeline-date">{date}</div>
        <div className="timeline-title">{title}</div>
        {description !== undefined && description !== "" && <div className="timeline-description">{description}</div>}
        {(badge !== undefined || avatar !== undefined || children !== undefined) && (
          <div className="timeline-meta">
            {badge !== undefined && (
              <div className="timeline-badge">
                {badge.icon !== undefined && <span className="timeline-badge-icon">{badge.icon}</span>}
                {badge.label}
              </div>
            )}
            {avatar !== undefined && avatar !== "" && (
              <div className="timeline-avatar">
                {avatar}
              </div>
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export interface TimelineProps {
  children: ComponentChildren
  className?: string
}

export function Timeline({ children, className = '' }: TimelineProps): JSX.Element {
  return <div className={`timeline ${className}`}>{children}</div>
}
