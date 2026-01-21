import type { JSX } from 'preact'
import { ComponentChildren, ComponentType } from 'preact'
import './Button.css'

interface IconProps {
  className?: string
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'standard' | 'small'
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  children: ComponentChildren
  icon?: ComponentType<IconProps>
  iconPosition?: 'left' | 'right'
  className?: string
  style?: Record<string, string>
}

export function Button({
  variant = 'primary',
  size = 'standard',
  disabled = false,
  onClick,
  type = 'button',
  children,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  style,
}: ButtonProps): JSX.Element {
  const buttonClass = [
    'button',
    `button-${variant}`,
    size === 'small' ? 'button-small' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {Icon !== undefined && iconPosition === 'left' && <Icon className="button-icon" />}
      {children}
      {Icon !== undefined && iconPosition === 'right' && <Icon className="button-icon" />}
    </button>
  )
}
