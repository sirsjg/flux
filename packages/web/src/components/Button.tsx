import { ComponentChildren } from 'preact'
import './Button.css'

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'standard' | 'small'
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  children: ComponentChildren
  icon?: any
  iconPosition?: 'left' | 'right'
  className?: string
  style?: any
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
}: ButtonProps) {
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
      {Icon && iconPosition === 'left' && <Icon className="button-icon" />}
      {children}
      {Icon && iconPosition === 'right' && <Icon className="button-icon" />}
    </button>
  )
}
