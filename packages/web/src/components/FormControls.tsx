import type { JSX } from 'preact'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import './FormControls.css'

// Radio
export interface RadioOption {
  value: string
  label: string
}

export interface RadioGroupProps {
  name: string
  options: RadioOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function RadioGroup({ name, options, value, onChange, className = '' }: RadioGroupProps) {
  return (
    <div className={`radio-group ${className}`}>
      {options.map((option) => (
        <label key={option.value} className="radio-item">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange((e.target as HTMLInputElement).value)}
            className="radio-input"
          />
          <span className="radio-indicator" />
          <span className="radio-label">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

// Checkbox
export interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Checkbox({ label, checked, onChange, className = '' }: CheckboxProps) {
  return (
    <label className={`checkbox-item ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        className="checkbox-input"
      />
      <span className="checkbox-indicator" />
      <span className="checkbox-label">{label}</span>
    </label>
  )
}

export interface CheckboxGroupProps {
  options: RadioOption[]
  values: string[]
  onChange: (values: string[]) => void
  className?: string
}

export function CheckboxGroup({ options, values, onChange, className = '' }: CheckboxGroupProps) {
  const handleChange = (optionValue: string, checked: boolean) => {
    if (checked) {
      onChange([...values, optionValue])
    } else {
      onChange(values.filter((v) => v !== optionValue))
    }
  }

  return (
    <div className={`checkbox-group ${className}`}>
      {options.map((option) => (
        <Checkbox
          key={option.value}
          label={option.label}
          checked={values.includes(option.value)}
          onChange={(checked) => handleChange(option.value, checked)}
        />
      ))}
    </div>
  )
}

// Select
export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function Select({ options, value, onChange, placeholder, className = '' }: SelectProps) {
  return (
    <div className={`select-wrapper ${className}`}>
      <select
        className="select-native"
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      >
        {placeholder !== undefined && placeholder !== "" && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="select-icon" />
    </div>
  )
}

// Form Label
export interface FormLabelProps {
  label: string
  htmlFor?: string
  required?: boolean
  className?: string
}

export function FormLabel({ label, htmlFor, required, className = '' }: FormLabelProps): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className={`form-label ${required === true ? 'form-label-required' : ''} ${className}`}
    >
      {label}
    </label>
  )
}
