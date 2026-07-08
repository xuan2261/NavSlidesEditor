import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn, isBackdropClick, useEscapeClose } from '../../lib/utils'
import { Button } from './Button'

const sizeClasses = {
  sm: 'max-w-[420px]',
  md: 'max-w-[480px]',
  lg: 'max-w-[560px]',
  xl: 'max-w-[800px]',
  '2xl': 'max-w-[960px]',
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(root) {
  return Array.from(root?.querySelectorAll(FOCUSABLE_SELECTOR) || []).filter(
    (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
  )
}

export function useModalFocusTrap({ initialFocusRef, autoFocus = true } = {}) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(
    typeof document === 'undefined' ? null : document.activeElement
  )

  useEffect(() => {
    const previousFocus = previousFocusRef.current

    if (autoFocus) {
      const target = initialFocusRef?.current || getFocusableElements(dialogRef.current)[0]
      target?.focus?.()
    }

    return () => {
      if (previousFocus?.isConnected) previousFocus.focus?.()
    }
  }, [autoFocus, initialFocusRef])

  const handleFocusTrapKeyDown = (event) => {
    if (event.defaultPrevented) return
    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements(dialogRef.current)
    if (!focusableElements.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return { dialogRef, handleFocusTrapKeyDown }
}

export function ModalShell({
  title,
  titleId,
  children,
  onClose,
  footer,
  size = 'md',
  className,
  bodyClassName,
  closeLabel,
  closeOnBackdrop = true,
}) {
  const closeButtonRef = useRef(null)
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({
    initialFocusRef: closeButtonRef,
  })

  const handleClose = () => {
    if (typeof onClose === 'function') onClose()
  }

  useEscapeClose(handleClose)

  return (
    <div
      data-testid="modal-shell-overlay"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (closeOnBackdrop && isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleFocusTrapKeyDown}
    >
      <div
        ref={dialogRef}
        data-testid="modal-shell-dialog"
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-[0_22px_70px_rgba(0,0,0,0.36)] max-h-[90vh]',
          sizeClasses[size],
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id={titleId} className="m-0 text-base font-semibold leading-6 text-text-primary">
            {title}
          </h2>
          <Button
            ref={closeButtonRef}
            data-testid="modal-shell-close-btn"
            variant="icon"
            onClick={handleClose}
            aria-label={closeLabel || `Close ${title}`}
          >
            <X size={16} />
          </Button>
        </div>
        <div className={cn('min-h-0 overflow-y-auto p-5', bodyClassName)}>{children}</div>
        {footer && (
          <div
            data-testid="modal-shell-footer"
            className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-panel px-5 py-4"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
