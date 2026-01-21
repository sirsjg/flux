import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import './Input.css'

export interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number'
  value?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  onChange?: (value: string) => void
  onInput?: (e: Event) => void
  onKeyDown?: (e: KeyboardEvent) => void
  size?: 'standard' | 'small' | 'large'
  error?: boolean
  className?: string
}

export function Input({
  type = 'text',
  value,
  placeholder,
  disabled = false,
  required = false,
  onChange,
  onInput,
  onKeyDown,
  size = 'standard',
  error = false,
  className = '',
}: InputProps) {
  const inputClass = [
    'input',
    size === 'small' ? 'input-small' : size === 'large' ? 'input-large' : '',
    error ? 'input-error-state' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    onChange?.(target.value)
    onInput?.(e)
  }

  return (
    <input
      type={type}
      className={inputClass}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      onInput={handleInput}
      onKeyDown={onKeyDown}
    />
  )
}

export interface SearchInputProps {
  value?: string
  placeholder?: string
  onChange?: (value: string) => void
  onClear?: () => void
  className?: string
}

export function SearchInput({
  value = '',
  placeholder = 'Search...',
  onChange,
  onClear,
  className = '',
}: SearchInputProps) {
  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    onChange?.(target.value)
  }

  const handleClear = () => {
    onChange?.('')
    onClear?.()
  }

  return (
    <div className={`search-input-wrapper ${className}`}>
      <MagnifyingGlassIcon className="search-input-icon" />
      <input
        type="text"
        className="input search-input"
        value={value}
        placeholder={placeholder}
        onInput={handleInput}
      />
      {value !== "" && (
        <button
          type="button"
          className="search-input-clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <XMarkIcon className="search-input-clear-icon" />
        </button>
      )}
    </div>
  )
}

export interface TextareaProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  onChange?: (value: string) => void
  rows?: number
  error?: boolean
  className?: string
}

export function Textarea({
  value,
  placeholder,
  disabled = false,
  onChange,
  rows = 4,
  error = false,
  className = '',
}: TextareaProps) {
  const textareaClass = [
    'textarea',
    error ? 'input-error-state' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const handleInput = (e: Event) => {
    const target = e.target as HTMLTextAreaElement
    onChange?.(target.value)
  }

  return (
    <textarea
      className={textareaClass}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onInput={handleInput}
      rows={rows}
    />
  )
}
