import { useRef, useCallback } from 'react'

export function usePinchZoom({
  containerRef,
  onZoomChange,
  minZoom = 0.25,
  maxZoom = 4.0,
  enabled = true,
}) {
  const pointers = useRef(new Map())
  const initialDistance = useRef(0)
  const initialZoom = useRef(1)

  const getDistance = (p1, p2) => {
    const dx = p2.clientX - p1.clientX
    const dy = p2.clientY - p1.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handlePointerDown = useCallback((e) => {
    if (!enabled) return
    pointers.current.set(e.pointerId, e)
    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values())
      initialDistance.current = getDistance(pts[0], pts[1])
      initialZoom.current = containerRef.current?.dataset.zoom
        ? parseFloat(containerRef.current.dataset.zoom)
        : 1
    }
  }, [enabled, containerRef])

  const handlePointerMove = useCallback((e) => {
    if (!enabled || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, e)

    if (pointers.current.size === 2 && initialDistance.current > 0) {
      const pts = Array.from(pointers.current.values())
      const currentDistance = getDistance(pts[0], pts[1])
      const ratio = currentDistance / initialDistance.current
      const newZoom = Math.min(maxZoom, Math.max(minZoom, initialZoom.current * ratio))
      onZoomChange?.(newZoom)
    }
  }, [enabled, onZoomChange, maxZoom, minZoom])

  const handlePointerUp = useCallback((e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) {
      initialDistance.current = 0
    }
  }, [])

  return {
    containerProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      // Capture all pointers for pinch
      style: { touchAction: 'none' },
    },
  }
}
