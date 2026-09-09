import { useEffect, useRef, useState } from 'preact/hooks'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
  class?: string
}

/**
 * Custom listbox styled to match the design system — replaces native
 * <select>, which ignores page styling and looks out of place.
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  class: className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (open) {
      setActiveIndex(options.findIndex((o) => o.value === value))
    }
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const select = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open && activeIndex >= 0) {
        select(options[activeIndex].value)
      } else {
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((prev) => {
        const start = prev < 0 ? (delta > 0 ? -1 : options.length) : prev
        return Math.min(options.length - 1, Math.max(0, start + delta))
      })
    }
  }

  return (
    <div
      ref={rootRef}
      class={`relative ${className ?? ''}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        class={`select-trigger w-full ${size === 'sm' ? 'select-trigger-sm' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
      >
        <span class="truncate">{selected?.label ?? ''}</span>
        <ChevronUpDownIcon className="h-4 w-4 text-base-content/40 flex-shrink-0" />
      </button>
      {open && (
        <ul ref={listRef} role="listbox" class="select-menu">
          {options.map((opt, i) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                tabIndex={-1}
                data-active={i === activeIndex}
                class="select-option"
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => select(opt.value)}
              >
                <span class="truncate flex-1 text-left">{opt.label}</span>
                {opt.value === value && (
                  <CheckIcon className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
