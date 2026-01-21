import { ComponentChildren } from 'preact'
import { XMarkIcon } from '@heroicons/react/24/outline'
import './SidePanel.css'

export interface SidePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
}

export function SidePanel({ isOpen, onClose, title, children }: SidePanelProps) {
  return (
    <>
      <div className={`side-panel-overlay ${isOpen ? 'active' : ''}`} onClick={onClose} />
      <div className={`side-panel ${isOpen ? 'open' : ''}`}>
        <div className="side-panel-header">
          <h2 className="side-panel-title">{title}</h2>
          <button
            className="side-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            <XMarkIcon />
          </button>
        </div>
        <div className="side-panel-body">{children}</div>
      </div>
    </>
  )
}
