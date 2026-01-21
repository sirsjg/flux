import { ComponentChildren } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
  boxClassName?: string
}

export function Modal({ isOpen, onClose, title, children, boxClassName }: ModalProps) {
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
      <div class={`modal-box w-full max-w-xl ${boxClassName ?? ''}`}>
        {title && <h3 class="font-bold text-lg mb-4">{title}</h3>}
        {children}
      </div>
    </dialog>
  )
}
