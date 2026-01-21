import type { JSX } from 'preact'
import type { Epic } from '@flux/shared'

interface EpicHeaderProps {
  epic: Epic
  onClick?: () => void
}

export function EpicHeader({ epic, onClick }: EpicHeaderProps): JSX.Element {
  return (
    <div
      class="p-3 border-b border-base-300 flex items-center justify-between cursor-pointer hover:bg-base-200 transition-colors"
      onClick={onClick}
    >
      <div class="flex items-center gap-2">
        <h4 class="font-semibold">{epic.title}</h4>
        <span class="badge badge-ghost badge-sm capitalize">{epic.status}</span>
      </div>
      {epic.notes !== "" && (
        <span class="text-xs text-base-content/60">{epic.notes}</span>
      )}
    </div>
  )
}
