import { useDroppable } from '@dnd-kit/core'
import { ComponentChildren } from 'preact'

interface DroppableColumnProps {
  id: string
  children: ComponentChildren
  isEmpty?: boolean
}

export function DroppableColumn({ id, children, isEmpty = false }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      data-over={isOver ? 'true' : 'false'}
      class={`board-column rounded-xl p-3 min-h-32 transition-all ${
        isOver
          ? 'bg-primary/10'
          : isEmpty
          ? 'border-dashed'
          : ''
      }`}
    >
      {isEmpty ? (
        <div class="h-full min-h-24 flex items-center justify-center">
          <span class="text-base-content/40 text-sm">No tasks</span>
        </div>
      ) : (
        <div class="space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}
