import { useDroppable } from '@dnd-kit/core'
import { ComponentChildren } from 'preact'

interface DroppableColumnProps {
  id: string
  children: ComponentChildren
  isEmpty?: boolean
  mobileHeader?: ComponentChildren
}

export function DroppableColumn({ id, children, isEmpty = false, mobileHeader }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      data-over={isOver ? 'true' : 'false'}
      class={`board-column rounded-xl p-3 min-h-32 ${
        isEmpty && !isOver ? 'board-column-empty' : ''
      }`}
    >
      <div class="flex items-center gap-2 mb-3 md:hidden">{mobileHeader}</div>
      {isEmpty ? (
        <div class="h-full min-h-24 flex items-center justify-center">
          <span class="text-base-content/40 text-sm">
            {isOver ? 'Drop here' : 'No tasks'}
          </span>
        </div>
      ) : (
        <div class="space-y-3 stagger-in">
          {children}
        </div>
      )}
    </div>
  )
}
