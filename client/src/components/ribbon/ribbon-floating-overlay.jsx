import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_GAP = 8
const ANCHOR_GAP = 4

export default function RibbonFloatingOverlay({
  open,
  anchorRef,
  onClose,
  children,
  className = '',
  role,
  ariaLabel,
  align = 'left',
  dataRibbonPopup,
  restoreFocus = true,
  onPositionChange,
}) {
  const overlayRef = useRef(null)
  const [position, setPosition] = useState(null)

  const focusAnchor = useCallback(() => {
    if (!restoreFocus) return
    anchorRef?.current?.focus?.()
  }, [anchorRef, restoreFocus])

  const requestClose = useCallback(() => {
    focusAnchor()
    onClose?.()
  }, [focusAnchor, onClose])

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current
    if (!anchor) return

    const anchorRect = anchor.getBoundingClientRect()
    const clippedRibbonRect = anchor.closest('.tour-step-ribbon')?.getBoundingClientRect()
    const overlayRect = overlayRef.current?.getBoundingClientRect()
    const overlayWidth = overlayRect?.width || anchorRect.width
    const overlayHeight = overlayRect?.height || 0
    const rawLeft = align === 'right' ? anchorRect.right - overlayWidth : anchorRect.left
    const maxLeft = window.innerWidth - overlayWidth - VIEWPORT_GAP
    const left = Math.max(VIEWPORT_GAP, Math.min(rawLeft, maxLeft))
    const anchorTop = anchorRect.bottom + ANCHOR_GAP
    const ribbonTop = clippedRibbonRect ? clippedRibbonRect.bottom + ANCHOR_GAP : 0
    const belowTop = Math.max(anchorTop, ribbonTop)
    const aboveTop = anchorRect.top - overlayHeight - ANCHOR_GAP
    const rawTop =
      overlayHeight > 0 && belowTop + overlayHeight > window.innerHeight - VIEWPORT_GAP
        ? aboveTop
        : belowTop
    const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - overlayHeight - VIEWPORT_GAP)
    const top = Math.max(VIEWPORT_GAP, Math.min(rawTop, maxTop))
    const nextPosition = { top, left, minWidth: anchorRect.width }

    setPosition(nextPosition)
    onPositionChange?.(nextPosition)
  }, [align, anchorRef, onPositionChange])

  useLayoutEffect(() => {
    if (!open) return undefined
    const raf = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(raf)
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      const anchor = anchorRef?.current
      const overlay = overlayRef.current
      if (anchor?.contains(event.target) || overlay?.contains(event.target)) return
      requestClose()
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      requestClose()
    }

    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, open, requestClose, updatePosition])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={overlayRef}
      role={role}
      aria-label={ariaLabel}
      data-ribbon-popup={dataRibbonPopup}
      className={className}
      style={{
        position: 'fixed',
        top: `${position?.top ?? 0}px`,
        left: `${position?.left ?? 0}px`,
        minWidth: `${position?.minWidth ?? 0}px`,
        opacity: position ? 1 : 0,
        pointerEvents: position ? 'auto' : 'none',
        zIndex: 1000,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
