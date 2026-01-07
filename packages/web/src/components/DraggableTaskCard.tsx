import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TaskWithBlocked } from '../stores'

interface DraggableTaskCardProps {
  task: TaskWithBlocked
  epicColor?: string
  epicTitle?: string
  taskNumber?: number
  onClick?: () => void
}

export function DraggableTaskCard({
  task,
  epicColor = '#9ca3af',
  epicTitle = 'Unassigned',
  taskNumber,
  onClick,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      class={`bg-base-100 rounded-lg shadow-sm p-4 cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing touch-none ${
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
        <span class="text-xs text-base-content/50 font-medium">{epicTitle}</span>
        {task.blocked && (
          <span class="ml-auto text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium">
            Blocked
          </span>
        )}
      </div>

      {/* Title */}
      <h4 class="font-semibold text-sm mb-1">{task.title}</h4>

      {/* Notes/Description */}
      {task.notes && (
        <p class="text-xs text-base-content/50 mb-3 line-clamp-2">{task.notes}</p>
      )}

      {/* Footer */}
      <div class="flex items-center justify-between mt-auto pt-2">
        <div class="flex items-center gap-2">
          {task.status === 'in_progress' && (
            <>
              <progress class="progress progress-success w-10" />
              <span class="badge badge-ghost badge-xs">Agent working</span>
            </>
          )}
          {task.depends_on.length > 0 && (
            <div class={`flex items-center gap-1 text-xs ${task.blocked ? 'text-warning' : 'text-base-content/40'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clip-rule="evenodd" transform="rotate(180 10 10)" />
              </svg>
              <span>{task.depends_on.length}</span>
            </div>
          )}
        </div>

        {/* Task Number */}
        {taskNumber && (
          <span class="text-xs text-base-content/40">#{taskNumber}</span>
        )}
      </div>
    </div>
  )
}
