import { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { ChevronRightIcon } from '@heroicons/react/24/outline'

interface CollapsibleSectionProps {
  title: string
  hint?: string
  count?: number
  icon?: ComponentChildren
  defaultOpen?: boolean
  children: ComponentChildren
}

/**
 * Expandable form section — keeps rarely-used detail (guardrails, attachments)
 * out of the way until it's needed, while surfacing a count at a glance.
 */
export function CollapsibleSection({
  title,
  hint,
  count,
  icon,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div class="border border-base-200 rounded-xl overflow-hidden mb-3">
      <button
        type="button"
        class="section-toggle w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <ChevronRightIcon
          className={`h-4 w-4 text-base-content/40 transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        />
        {icon}
        <span class="font-medium text-sm">{title}</span>
        {count !== undefined && count > 0 && (
          <span class="badge badge-sm badge-ghost font-mono">{count}</span>
        )}
        {hint && !open && (
          <span class="ml-auto text-xs text-base-content/40 truncate hidden sm:block">
            {hint}
          </span>
        )}
      </button>
      {open && <div class="section-body px-3.5 pb-3.5">{children}</div>}
    </div>
  )
}
