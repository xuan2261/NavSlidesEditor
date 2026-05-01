import { useRef, useCallback } from 'react'

const TAP_DELAY = 200
const LONG_PRESS_DELAY = 500
const DRAG_THRESHOLD = 5

export function useTouchGestures({
  onTap,
  onDoubleTap,
  onLongPress,
  onDragStart,
  onDrag,
  onDragEnd,
  enabled = true,
}) {
  const state = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    isDragging: false,
    isLongPress: false,
    longPressTimer: null,
    lastTapTime: 0,
    pendingTapX: 0,
    pendingTapY: 0,
    tapTimer: null,
  })

  const handlePointerDown = useCallback(
    (e) => {
      if (!enabled) return
      e.preventDefault()
      state.current = {
        ...state.current,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTime: Date.now(),
        isDragging: false,
        isLongPress: false,
        longPressTimer: null,
        tapTimer: null, // cancel any pending onTap
      }
      // Long press timer
      state.current.longPressTimer = setTimeout(() => {
        if (!state.current.isDragging) {
          state.current.isLongPress = true
          onLongPress?.(e.clientX, e.clientY)
        }
      }, LONG_PRESS_DELAY)
    },
    [enabled, onLongPress]
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (!enabled || state.current.pointerId !== e.pointerId) return
      const dx = e.clientX - state.current.startX
      const dy = e.clientY - state.current.startY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > DRAG_THRESHOLD && !state.current.isDragging) {
        // Cancel long press and pending tap, start drag
        if (state.current.longPressTimer) {
          clearTimeout(state.current.longPressTimer)
        }
        if (state.current.tapTimer) {
          clearTimeout(state.current.tapTimer)
          state.current.tapTimer = null
        }
        state.current.isDragging = true
        onDragStart?.(e.clientX, e.clientY)
      }

      if (state.current.isDragging) {
        onDrag?.(e.clientX, e.clientY)
      }
    },
    [enabled, onDragStart, onDrag]
  )

  const handlePointerUp = useCallback(
    (e) => {
      if (!enabled || state.current.pointerId !== e.pointerId) return

      if (state.current.longPressTimer) {
        clearTimeout(state.current.longPressTimer)
      }

      if (state.current.isLongPress) {
        state.current.isLongPress = false
        state.current.pointerId = null
        return
      }

      if (state.current.isDragging) {
        onDragEnd?.(e.clientX, e.clientY)
      } else {
        const elapsed = Date.now() - state.current.startTime
        if (elapsed < TAP_DELAY) {
          const now = Date.now()
          if (now - state.current.lastTapTime < 300) {
            // Second tap of a double-tap — cancel pending onTap, fire double
            if (state.current.tapTimer) {
              clearTimeout(state.current.tapTimer)
              state.current.tapTimer = null
            }
            state.current.lastTapTime = 0
            onDoubleTap?.(e.clientX, e.clientY)
          } else {
            // First tap — check if a deferred onTap is pending and clear it,
            // then queue a fresh onTap. We track pending coordinates.
            state.current.pendingTapX = e.clientX
            state.current.pendingTapY = e.clientY
            state.current.tapTimer = setTimeout(() => {
              onTap?.(state.current.pendingTapX, state.current.pendingTapY)
              state.current.pendingTapX = 0
              state.current.pendingTapY = 0
            }, 300)
            state.current.lastTapTime = now
          }
        }
      }

      state.current.pointerId = null
    },
    [enabled, onTap, onDoubleTap, onDragEnd]
  )

  const handlePointerCancel = useCallback(() => {
    if (state.current.longPressTimer) {
      clearTimeout(state.current.longPressTimer)
    }
    if (state.current.tapTimer) {
      clearTimeout(state.current.tapTimer)
    }
    state.current.pointerId = null
    state.current.isDragging = false
    state.current.isLongPress = false
    state.current.tapTimer = null
  }, [])

  return {
    pointerDownProps: {
      onPointerDown: handlePointerDown,
    },
    pointerMoveProps: {
      onPointerMove: handlePointerMove,
    },
    pointerUpProps: {
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  }
}
