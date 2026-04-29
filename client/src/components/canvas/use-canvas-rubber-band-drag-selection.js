import { useRef, useCallback } from 'react'

/**
 * use-canvas-rubber-band-drag-selection — rubber-band (marquee) drag selection helpers.
 * Manages refs for rubber-band drag state to avoid stale closures in
 * document-level event listeners.
 */
export default function useCanvasRubberBandSelection({ slide, onToggleSelectElement, rubberBandRef: externalRef }) {
  const internalRef = useRef(null) // { startX, startY, currentX, currentY }
  const rubberBandRef = externalRef || internalRef

  const startRubberBand = useCallback((startX, startY) => {
    // eslint-disable-next-line react-hooks/immutability -- mutable ref intentionally shared with useCanvasPointerInteraction
    rubberBandRef.current = { startX, startY, currentX: startX, currentY: startY }
  }, [rubberBandRef])

  const updateRubberBand = useCallback((currentX, currentY) => {
    if (!rubberBandRef.current) return
    rubberBandRef.current.currentX = currentX
    rubberBandRef.current.currentY = currentY
  }, [rubberBandRef])

  /**
   * Complete rubber-band drag and return intersecting element ids.
   * @param {function} setRubberBand - React state setter for render state
   * @returns {string[]} hit element ids
   */
  const endRubberBand = useCallback((setRubberBand) => {
    const rb = rubberBandRef.current
    if (!rb) return []
    rubberBandRef.current = null // eslint-disable-line react-hooks/immutability
    setRubberBand(null)

    const x1 = Math.min(rb.startX, rb.currentX)
    const y1 = Math.min(rb.startY, rb.currentY)
    const x2 = Math.max(rb.startX, rb.currentX)
    const y2 = Math.max(rb.startY, rb.currentY)

    if (x2 - x1 <= 4 && y2 - y1 <= 4) return []

    const els = slide?.elements || []
    return els
      .filter((el) => {
        const ex1 = el.x
        const ey1 = el.y
        const ex2 = el.x + el.width
        const ey2 = el.y + el.height
        return ex1 < x2 && ex2 > x1 && ey1 < y2 && ey2 > y1
      })
      .map((el) => el.id)
  }, [slide, rubberBandRef])

  const applyRubberBandSelection = useCallback((hitIds) => {
    if (hitIds.length === 0) return
    onToggleSelectElement(null, false)
    hitIds.forEach((id) => onToggleSelectElement(id, true))
  }, [onToggleSelectElement])

  return {
    rubberBandRef,
    startRubberBand,
    updateRubberBand,
    endRubberBand,
    applyRubberBandSelection,
  }
}
