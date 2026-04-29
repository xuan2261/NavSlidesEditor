import { useEffect } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function isBackdropClick(event) {
  return event.target === event.currentTarget
}

export function useEscapeClose(onClose) {
  useEffect(() => {
    if (typeof onClose !== 'function') return undefined

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
}
