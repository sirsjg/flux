import { ArrowDownIcon, CheckCircleIcon, PaperClipIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { EPIC_COLOR_UNASSIGNED } from '@flux/shared'
import type { TaskWithBlocked } from '../stores'

interface DraggableTaskCardProps {
  task: TaskWithBlocked
  epicColor?: string
  epicTitle?: string
  taskNumber?: number
  onClick?: () => void
  condensed?: boolean
}

// Agent name pill — truncates instead of wrapping when names run long
function WorkerChip({ name }: { name: string }) {
  return (
    <span class="worker-chip" title={name}>
      <span class="worker-chip-dot" />
      <span class="worker-chip-name">{name}</span>
    </span>
  )
}

export function DraggableTaskCard({
  task,
  epicColor = EPIC_COLOR_UNASSIGNED,
  epicTitle = 'Unassigned',
  taskNumber,
  onClick,
  condensed = false,
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  const handleClick = () => {
    if (!isDragging && onClick) {
      onClick()
    }
  }

  const workers = task.workers ?? []

  // Shared indicator badges for acceptance criteria and guardrails
  const renderMetaIndicators = (compact = false) => (
    <>
      {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
        <div class={`flex items-center ${compact ? 'gap-0.5 flex-shrink-0' : 'gap-1'} text-xs text-success/70`} title="Acceptance criteria">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          <span>{task.acceptance_criteria.length}</span>
        </div>
      )}
      {task.guardrails && task.guardrails.length > 0 && (
        <div class={`flex items-center ${compact ? 'gap-0.5 flex-shrink-0' : 'gap-1'} text-xs text-info/70`} title="Guardrails">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          <span>{task.guardrails.length}</span>
        </div>
      )}
      {task.blob_ids && task.blob_ids.length > 0 && (
        <div class={`flex items-center ${compact ? 'gap-0.5 flex-shrink-0' : 'gap-1'} text-xs text-base-content/50`} title="Attachments">
          <PaperClipIcon className="h-3.5 w-3.5" />
          <span>{task.blob_ids.length}</span>
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
        class={`task-card rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing touch-none ${
          task.blocked ? 'ring-2 ring-warning/50' : ''
        }`}
        onClick={handleClick}
        {...(listeners as any)}
        role={attributes.role}
        tabIndex={attributes.tabIndex}
        aria-pressed={attributes['aria-pressed']}
        aria-roledescription={attributes['aria-roledescription']}
        aria-describedby={attributes['aria-describedby']}
      >
        <div class="flex items-center gap-2">
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: epicColor }}
          />
          <span class="font-medium text-sm truncate flex-1">{task.title}</span>
          {task.blocked && (
            <span class="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium flex-shrink-0">
              Blocked
            </span>
          )}
          {renderMetaIndicators(true)}
          {task.status === 'in_progress' && (
            <>
              <span class="working-bar w-8 flex-shrink-0" />
              {workers.length > 0 && <WorkerChip name={workers[0]} />}
              {workers.length > 1 && (
                <span
                  class="text-xs text-base-content/50 flex-shrink-0"
                  title={workers.slice(1).join(', ')}
                >
                  +{workers.length - 1}
                </span>
              )}
            </>
          )}
          {task.status === 'done' && (
            <CheckCircleIcon className="h-4 w-4 text-success flex-shrink-0" />
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
      class={`task-card rounded-xl p-4 cursor-grab active:cursor-grabbing touch-none ${
        task.blocked ? 'ring-2 ring-warning/50' : ''
      }`}
      onClick={handleClick}
      {...(listeners as any)}
      role={attributes.role}
      tabIndex={attributes.tabIndex}
      aria-pressed={attributes['aria-pressed']}
      aria-roledescription={attributes['aria-roledescription']}
      aria-describedby={attributes['aria-describedby']}
    >
      {/* Epic Label */}
      <div class="flex items-center gap-1.5 mb-2">
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: epicColor }}
        />
        <span class="text-xs text-base-content/50 font-medium truncate">{epicTitle}</span>
        {task.blocked && (
          <span class="ml-auto text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium flex-shrink-0">
            Blocked
          </span>
        )}
      </div>

      {/* Title */}
      <h4 class="font-semibold text-sm mb-1">{task.title}</h4>

      {/* Latest comment preview */}
      {task.comments && task.comments.length > 0 && (
        <p class="text-xs text-base-content/50 mb-3 line-clamp-2">
          {task.comments[task.comments.length - 1].body}
        </p>
      )}

      {/* Active agents get their own row so long names truncate, never wrap */}
      {task.status === 'in_progress' && workers.length > 0 && (
        <div class="flex items-center gap-1.5 mb-2 overflow-hidden">
          {workers.slice(0, 2).map(name => (
            <WorkerChip key={name} name={name} />
          ))}
          {workers.length > 2 && (
            <span
              class="text-xs text-base-content/50 flex-shrink-0"
              title={workers.slice(2).join(', ')}
            >
              +{workers.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div class="flex items-center justify-between mt-auto pt-2">
        <div class="flex items-center gap-2 min-w-0">
          {task.status === 'planning' && (
            <span class="badge badge-ghost badge-secondary badge-xs flex-shrink-0">Planning</span>
          )}
          {task.status === 'todo' && (
            <span class="badge badge-ghost badge-xs flex-shrink-0">To do</span>
          )}
          {task.status === 'in_progress' && (
            <>
              <span class="working-bar w-10 flex-shrink-0" />
              <span class="badge badge-ghost badge-warning badge-xs flex-shrink-0">
                Agent working
              </span>
            </>
          )}
          {task.status === 'done' && (
            <span class="badge badge-ghost badge-success badge-xs flex-shrink-0">Done</span>
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
        {taskNumber && (
          <span class="text-xs text-base-content/40 flex-shrink-0">#{taskNumber}</span>
        )}
      </div>
    </div>
  )
}
