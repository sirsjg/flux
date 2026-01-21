import { ComponentChildren } from 'preact'
import { XMarkIcon } from '@heroicons/react/24/outline'
import './Modal.css'

export interface ModalNewProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'small' | 'medium' | 'large'
  children: ComponentChildren
  footer?: ComponentChildren
  showCloseButton?: boolean
}

export function ModalNew({
  isOpen,
  onClose,
  title,
  size = 'medium',
  children,
  footer,
  showCloseButton = true,
}: ModalNewProps): preact.JSX.Element | null {
  if (!isOpen) return null

  const handleOverlayClick = (e: MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const containerClass = `modal-container modal-container-${size}`

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={containerClass}>
        {(title !== undefined || showCloseButton) && (
          <div className="modal-header">
            {title !== undefined && title !== "" && <h2 className="modal-title">{title}</h2>}
            {showCloseButton && (
              <button
                type="button"
                className="modal-close-button"
                onClick={onClose}
                aria-label="Close modal"
              >
                <XMarkIcon className="modal-close-icon" />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer !== undefined && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
