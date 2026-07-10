import { useLayoutEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const escapeCloseStack = []

function handleEscapeKeyDown(event) {
  if (event.key !== 'Escape') return
  const topmostEntry = escapeCloseStack[escapeCloseStack.length - 1]
  if (typeof topmostEntry?.onCloseRef.current === 'function') {
    topmostEntry.onCloseRef.current()
  }
}

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function isBackdropClick(event) {
  return event.target === event.currentTarget
}

export function useEscapeClose(onClose) {
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useLayoutEffect(() => {
    const entry = { onCloseRef }
    escapeCloseStack.push(entry)
    if (escapeCloseStack.length === 1) {
      document.addEventListener('keydown', handleEscapeKeyDown)
    }

    return () => {
      const index = escapeCloseStack.indexOf(entry)
      if (index !== -1) escapeCloseStack.splice(index, 1)
      if (escapeCloseStack.length === 0) {
        document.removeEventListener('keydown', handleEscapeKeyDown)
      }
    }
  }, [])
}
