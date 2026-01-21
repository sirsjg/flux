import type { JSX } from 'preact'
import { ComponentChildren } from 'preact'
import './Avatar.css'

export interface AvatarProps {
  src?: string
  alt?: string
  initials?: string
  size?: 'small' | 'medium' | 'large' | 'xl'
  status?: 'online' | 'offline' | 'busy' | 'away'
  className?: string
}

export function Avatar({
  src,
  alt = '',
  initials,
  size = 'medium',
  status,
  className = '',
}: AvatarProps): JSX.Element {
  const avatarClass = [
    'avatar',
    `avatar-${size}`,
    status !== undefined ? 'avatar-with-status' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={avatarClass}>
      {src !== undefined && src !== "" ? (
        <img src={src} alt={alt} className="avatar-image" />
      ) : (
        <span>{initials ?? alt.charAt(0).toUpperCase()}</span>
      )}
      {status !== undefined && <span className={`avatar-status avatar-status-${status}`} />}
    </div>
  )
}

export interface AvatarGroupProps {
  children: ComponentChildren
  className?: string
}

export function AvatarGroup({
  children,
  className = '',
}: AvatarGroupProps): JSX.Element {
  return <div className={`avatar-group ${className}`}>{children}</div>
}
