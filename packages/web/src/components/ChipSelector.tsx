import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'
import './ChipSelector.css'

export interface ChipOption {
  value: string
  label: string
}

export interface ChipSelectorProps {
  options: ChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  onAdd?: () => void
  addLabel?: string
  className?: string
}

export function ChipSelector({
  options,
  selected,
  onChange,
  onAdd,
  addLabel = 'Add',
  className = '',
}: ChipSelectorProps) {
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value))
  }

  return (
    <div className={`chip-selector ${className}`}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value)
        return (
          <div
            key={option.value}
            className={`chip ${isSelected ? 'chip-selected' : ''}`}
            onClick={() => handleToggle(option.value)}
          >
            {option.label}
            {isSelected && (
              <button
                className="chip-close"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(option.value)
                }}
                aria-label="Remove"
              >
                <XMarkIcon />
              </button>
            )}
          </div>
        )
      })}

      {onAdd !== undefined && (
        <button className="chip-add" onClick={onAdd}>
          <PlusIcon />
          {addLabel}
        </button>
      )}
    </div>
  )
}
