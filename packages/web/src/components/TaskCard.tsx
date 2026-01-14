import type { TaskWithBlocked } from '../stores'

interface TaskCardProps {
  task: TaskWithBlocked
  onClick?: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div
      class="card bg-base-100 shadow-sm mb-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div class="card-body p-3">
        <div class="flex items-start justify-between gap-2">
          <h4 class="font-medium text-sm">{task.title}</h4>
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
