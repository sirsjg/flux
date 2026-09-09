import { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { XMarkIcon } from '@heroicons/react/24/outline'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'w-[min(72rem,94vw)] max-w-none',
  full: 'w-[94vw] h-[88vh] max-w-none max-h-none',
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ComponentChildren
  size?: ModalSize
  boxClassName?: string
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  boxClassName,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  const handleBackdropClick = (e: MouseEvent) => {
    const dialog = dialogRef.current
    if (e.target === dialog) {
      onClose()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      class="modal"
      onClick={handleBackdropClick}
      onClose={onClose}
    >
      <div
        class={`modal-box modal-surface w-full p-0 flex flex-col ${SIZE_CLASSES[size]} ${boxClassName ?? ''}`}
      >
        <div class="modal-header shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-base-200">
          <div class="min-w-0">
            <h3 class="font-bold text-lg leading-tight truncate">{title}</h3>
            {subtitle && (
              <p class="text-sm text-base-content/50 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm btn-circle -mr-2 -mt-1 flex-shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div class="modal-body px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </dialog>
  )
}
