import type { JSX } from 'preact'
import './Skeleton.css'

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  variant?: 'text' | 'text-sm' | 'text-lg' | 'circle' | 'rect'
  className?: string
}

export function Skeleton({ width, height, variant = 'text', className = '' }: SkeletonProps): JSX.Element {
  const style: Record<string, string> = {}
  if (width !== undefined) style.width = typeof width === 'number' ? `${width}px` : width
  if (height !== undefined) style.height = typeof height === 'number' ? `${height}px` : height

  return <div className={`skeleton skeleton-${variant} ${className}`} style={style} />
}

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps): JSX.Element {
  const sizeClass = size === 'md' ? '' : `spinner-${size}`
  return <div className={`spinner ${sizeClass} ${className}`} />
}

export interface LoadingContainerProps {
  fullscreen?: boolean
  children?: JSX.Element
}

export function LoadingContainer({ fullscreen = false, children }: LoadingContainerProps): JSX.Element {
  return (
    <div className={`loading-container ${fullscreen ? 'loading-container-fullscreen' : ''}`}>
      {children ?? <Spinner size="lg" />}
    </div>
  )
}

export function SkeletonCard(): JSX.Element {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <Skeleton variant="circle" width={32} height={32} />
        <Skeleton width="60%" height={16} />
      </div>
      <div className="skeleton-card-body">
        <Skeleton width="100%" />
        <Skeleton width="90%" />
        <Skeleton width="75%" />
      </div>
      <div className="skeleton-card-footer">
        <Skeleton variant="rect" width={60} height={24} />
        <Skeleton variant="rect" width={60} height={24} />
        <Skeleton variant="circle" width={24} height={24} />
      </div>
    </div>
  )
}

export function SkeletonBoard(): JSX.Element {
  return (
    <div className="skeleton-board">
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="skeleton-column">
          <div className="skeleton-column-header skeleton-pulse" />
          {[1, 2, 3].map((card) => (
            <SkeletonCard key={card} />
          ))}
        </div>
      ))}
    </div>
  )
}
