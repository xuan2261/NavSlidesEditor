import { useEffect, useRef } from 'react'

const SWIPE_THRESHOLD = 50

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  onSwipeDown,
  threshold = SWIPE_THRESHOLD,
  enabled = true,
}) {
  const touchState = useRef({ startX: 0, startY: 0, startTime: 0 })

  useEffect(() => {
    if (!enabled) return

    const handleTouchStart = (e) => {
      const touch = e.touches[0]
      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
      }
    }

    const handleTouchEnd = (e) => {
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchState.current.startX
      const dy = touch.clientY - touchState.current.startY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < threshold) return

      const elapsed = Date.now() - touchState.current.startTime
      if (elapsed > 1000) return // ignore slow swipes

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe
        if (dx > threshold) {
          onSwipeRight?.()
        } else if (dx < -threshold) {
          onSwipeLeft?.()
        }
      } else {
        // Vertical swipe
        if (dy > threshold) {
          onSwipeDown?.()
        }
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enabled, onSwipeLeft, onSwipeRight, onSwipeDown, threshold])
// Note: onSwipeDown intentionally included — used in the vertical-swipe branch of handleTouchEnd
}
