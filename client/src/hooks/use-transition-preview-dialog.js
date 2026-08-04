import { useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), iframe, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useTransitionPreviewDialog({ dialogRef, closeButtonRef, onClose }) {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined
    const previousFocus = document.activeElement
    const previousFocusTarget =
      previousFocus && typeof previousFocus.focus === 'function' ? previousFocus : null
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => {
      window.clearTimeout(focusTimer)
      previousFocusTarget?.focus?.()
    }
  }, [closeButtonRef])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const getFocusableElements = () =>
      Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])
        .filter((element) => !element.hasAttribute('disabled'))

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }
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

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialogRef, onClose])
}
