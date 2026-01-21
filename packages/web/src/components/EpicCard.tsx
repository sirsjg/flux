import type { JSX } from 'preact'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import './EpicCard.css'

export interface EpicCardProps {
  title: string
  description?: string
  totalTasks: number
  completedTasks: number
  color?: 'purple' | 'blue' | 'green' | 'orange' | 'red'
  onClick?: () => void
  className?: string
}

export function EpicCard({
  title,
  description,
  totalTasks,
  completedTasks,
  color = 'blue',
  onClick,
  className = '',
}: EpicCardProps): JSX.Element {
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const cardClass = [
    'epic-card',
    `epic-card-${color}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cardClass} onClick={onClick}>
      <div className="epic-card-header">
        <h3 className="epic-card-title">{title}</h3>
        <span className="epic-card-status-dot" style={{ background: getColorHex(color) }} />
      </div>

      {description !== undefined && description !== "" && (
        <p className="epic-card-description">{description}</p>
      )}

      <div className="epic-card-footer">
        <div className="epic-card-progress">
          <div className="epic-card-progress-label">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="epic-card-progress-bar">
            <div
              className="epic-card-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="epic-card-meta">
          <div className="epic-card-count">
            <CheckCircleIcon className="epic-card-count-icon" />
            <span>{completedTasks}/{totalTasks}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getColorHex(color: string): string {
  const colorMap: Record<string, string> = {
    purple: '#a855f7',
    blue: '#3b82f6',
    green: '#22c55e',
    orange: '#f59e0b',
    red: '#ef4444',
  }
  return colorMap[color] ?? '#3b82f6'
}
