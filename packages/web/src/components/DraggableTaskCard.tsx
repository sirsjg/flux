import type { JSX } from 'preact'
import { ArrowDownIcon, CheckCircleIcon, ShieldCheckIcon, ExclamationTriangleIcon, SparklesIcon, ArrowPathIcon, DocumentTextIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TaskWithBlocked } from '../stores'
import { PRIORITY_CONFIG, TASK_TYPE_CONFIG, type TaskType } from '@flux/shared'

interface DraggableTaskCardProps {
  task: TaskWithBlocked
  epicColor?: string
  epicTitle?: string
  taskNumber?: number
  onClick?: () => void
  condensed?: boolean
}

export function DraggableTaskCard({
  task,
  epicColor = '#9ca3af',
  epicTitle = 'Unassigned',
  taskNumber,
  onClick,
  condensed = false,
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  // Extract attributes without role to avoid type conflict
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { role, ...restAttributes } = attributes

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const handleClick = (): void => {
    if (!isDragging && onClick !== undefined) {
      onClick()
    }
  }

  // Icon mapping for task types
  type IconComponent = typeof CheckCircleIcon
  const TASK_TYPE_ICONS: Record<string, IconComponent> = {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    SparklesIcon,
    ArrowPathIcon,
    DocumentTextIcon,
    WrenchScrewdriverIcon,
  }

  // Get icon component for task type
  const getTypeIcon = (type: TaskType): IconComponent => {
    const config = TASK_TYPE_CONFIG[type]
    return TASK_TYPE_ICONS[config.icon] ?? CheckCircleIcon
  }

  // Tailwind color mapping (using standard Tailwind colors)
  const getTypeColor = (color: string): string => {
    const colorMap: Record<string, string> = {
      gray: 'text-gray-600 bg-gray-100',
      red: 'text-red-600 bg-red-100',
      purple: 'text-purple-600 bg-purple-100',
      blue: 'text-blue-600 bg-blue-100',
      green: 'text-green-600 bg-green-100',
      amber: 'text-amber-600 bg-amber-100',
    }
    return colorMap[color] ?? 'text-gray-600 bg-gray-100'
  }

  // Shared indicator badges for acceptance criteria and guardrails
  const renderMetaIndicators = (compact = false): JSX.Element => (
    <>
      {task.acceptance_criteria !== undefined && task.acceptance_criteria !== null && task.acceptance_criteria.length > 0 && (
        <div class={`flex items-center ${compact ? 'gap-0.5 flex-shrink-0' : 'gap-1'} text-xs text-success/70`} title="Acceptance criteria">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          <span>{task.acceptance_criteria.length}</span>
        </div>
      )}
      {task.guardrails !== undefined && task.guardrails !== null && task.guardrails.length > 0 && (
        <div class={`flex items-center ${compact ? 'gap-0.5 flex-shrink-0' : 'gap-1'} text-xs text-info/70`} title="Guardrails">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          <span>{task.guardrails.length}</span>
        </div>
      )}
    </>
  )

  // Condensed view
  if (condensed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        class={`bg-base-100 rounded-lg shadow-sm px-3 py-2 cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing touch-none ${
          task.blocked ? 'ring-2 ring-warning/50' : ''
        }`}
        onClick={handleClick}
        {...listeners}
        {...restAttributes}
      >
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: epicColor }}
          />
          <span class="font-medium text-sm truncate flex-1">{task.title}</span>
          {(() => {
            const taskType = task.type ?? 'task'
            const typeConfig = TASK_TYPE_CONFIG[taskType]
            const TypeIcon = getTypeIcon(taskType)
            return (
              <span class={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getTypeColor(typeConfig.color)}`} title={typeConfig.label}>
                <TypeIcon className="h-3 w-3" />
              </span>
            )
          })()}
          {task.priority !== undefined && (
            <span
              class="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              style={{
                backgroundColor: `${PRIORITY_CONFIG[task.priority].color}20`,
                color: PRIORITY_CONFIG[task.priority].color
              }}
            >
              {PRIORITY_CONFIG[task.priority].label}
            </span>
          )}
          {task.blocked && (
            <span class="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              Blocked
            </span>
          )}
          {renderMetaIndicators(true)}
          {task.status === 'planning' && (
            <progress class="progress progress-secondary w-8 flex-shrink-0" value={0} max={100} />
          )}
          {task.status === 'todo' && (
            <progress class="progress w-8 flex-shrink-0" value={0} max={100} />
          )}
          {task.status === 'in_progress' && (
            <progress class="progress progress-warning w-8 flex-shrink-0" />
          )}
          {task.status === 'done' && (
            <progress class="progress progress-success w-8 flex-shrink-0" value={100} max={100} />
          )}
        </div>
      </div>
    )
  }

  // Normal view
  return (
    <div
      ref={setNodeRef}
      style={style}
      class={`bg-base-100 rounded-lg shadow-sm p-4 cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing touch-none ${
        task.blocked ? 'ring-2 ring-warning/50' : ''
      }`}
      onClick={handleClick}
      {...listeners}
      {...restAttributes}
    >
      {/* Epic Label */}
      <div class="flex items-center gap-1.5 mb-2">
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: epicColor }}
        />
        <span class="text-xs text-base-content/50 font-medium">{epicTitle}</span>
        {(() => {
          const taskType = task.type ?? 'task'
          const typeConfig = TASK_TYPE_CONFIG[taskType]
          const TypeIcon = getTypeIcon(taskType)
          return (
            <span class={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${getTypeColor(typeConfig.color)}`} title={typeConfig.label}>
              <TypeIcon className="h-3 w-3" />
              <span>{typeConfig.label}</span>
            </span>
          )
        })()}
        {task.priority !== undefined && (
          <span
            class="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${PRIORITY_CONFIG[task.priority].color}20`,
              color: PRIORITY_CONFIG[task.priority].color
            }}
          >
            {PRIORITY_CONFIG[task.priority].label}
          </span>
        )}
        {task.blocked && (
          <span class="ml-auto text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium">
            Blocked
          </span>
        )}
      </div>

      {/* Title */}
      <h4 class="font-semibold text-sm mb-1">{task.title}</h4>

      {/* Latest comment preview */}
      {task.comments !== undefined && task.comments !== null && task.comments.length > 0 && (
        <p class="text-xs text-base-content/50 mb-3 line-clamp-2">
          {task.comments[task.comments.length - 1]?.body}
        </p>
      )}

      {/* Footer */}
      <div class="flex items-center justify-between mt-auto pt-2">
        <div class="flex items-center gap-2">
          {task.status === 'planning' && (
            <>
              <progress class="progress progress-secondary w-10" value={0} max={100} />
              <span class="badge badge-ghost badge-secondary badge-xs">Planning</span>
            </>
          )}
          {task.status === 'todo' && (
            <>
              <progress class="progress w-10" value={0} max={100} />
              <span class="badge badge-ghost badge-xs">To do</span>
            </>
          )}
          {task.status === 'in_progress' && (
            <>
              <progress class="progress progress-warning w-10" />
              <span class="badge badge-ghost badge-warning badge-xs">Agent working</span>
            </>
          )}
          {task.status === 'done' && (
            <>
              <progress class="progress progress-success w-10" value={100} max={100} />
              <span class="badge badge-ghost badge-success badge-xs">Done</span>
            </>
          )}
          {task.depends_on.length > 0 && (
            <div class={`flex items-center gap-1 text-xs ${task.blocked ? 'text-warning' : 'text-base-content/40'}`}>
              <ArrowDownIcon className="h-3.5 w-3.5" />
              <span>{task.depends_on.length}</span>
            </div>
          )}
          {renderMetaIndicators()}
        </div>

        {/* Task Number */}
        {taskNumber !== undefined && (
          <span class="text-xs text-base-content/40">#{taskNumber}</span>
        )}
      </div>
    </div>
  )
}
