import { CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon, ArrowPathIcon, DocumentTextIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import type { TaskWithBlocked } from '../stores'
import { TASK_TYPE_CONFIG, type TaskType } from '@flux/shared'

// Icon mapping for task types
const TASK_TYPE_ICONS: Record<string, any> = {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
}

// Get icon component for task type
const getTypeIcon = (type: TaskType) => {
  const config = TASK_TYPE_CONFIG[type]
  return TASK_TYPE_ICONS[config.icon]
}

// Tailwind color mapping
const getTypeColor = (color: string) => {
  const colorMap: Record<string, string> = {
    gray: 'text-gray-600 bg-gray-100',
    red: 'text-red-600 bg-red-100',
    purple: 'text-purple-600 bg-purple-100',
    blue: 'text-blue-600 bg-blue-100',
    green: 'text-green-600 bg-green-100',
    amber: 'text-amber-600 bg-amber-100',
  }
  return colorMap[color] || 'text-gray-600 bg-gray-100'
}

interface TaskCardProps {
  task: TaskWithBlocked
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const taskType = task.type || 'task'
  const TypeIcon = getTypeIcon(taskType as TaskType)
  const typeConfig = TASK_TYPE_CONFIG[taskType as TaskType]

  return (
    <div
      class="card bg-base-100 shadow-sm mb-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div class="card-body p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 flex-1">
            <h4 class="font-medium text-sm">{task.title}</h4>
            <span class={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getTypeColor(typeConfig.color)}`} title={typeConfig.label}>
              <TypeIcon className="h-3 w-3" />
            </span>
          </div>
          {task.blocked && (
            <span class="badge badge-warning badge-sm" title={task.blocked_reason || undefined}>
              {task.blocked_reason ? 'Waiting' : 'Blocked'}
            </span>
          )}
        </div>
        {task.blocked_reason && (
          <div class="text-xs text-warning mt-1">
            ⏳ {task.blocked_reason}
          </div>
        )}
        {task.comments && task.comments.length > 0 && !task.blocked_reason && (
          <p class="text-xs text-base-content/60 mt-1 line-clamp-2">
            {task.comments[task.comments.length - 1].body}
          </p>
        )}
        {task.blocked && !task.blocked_reason && task.depends_on.length > 0 && (
          <div class="text-xs text-base-content/50 mt-1">
            {task.depends_on.length} incomplete dep{task.depends_on.length > 1 ? 's' : ''}
          </div>
        )}
        {!task.blocked && task.depends_on.length > 0 && (
          <div class="text-xs text-success mt-1">
            All {task.depends_on.length} dep{task.depends_on.length > 1 ? 's' : ''} done
          </div>
        )}
        {task.status === 'in_progress' && (
          <div class="mt-2 flex items-center gap-1 text-xs text-primary">
            <span class="loading loading-spinner loading-xs text-primary" />
            In progress
          </div>
        )}
      </div>
    </div>
  )
}
