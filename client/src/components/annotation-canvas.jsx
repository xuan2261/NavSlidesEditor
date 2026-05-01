import React, { useRef, useState, useCallback } from 'react'

export function AnnotationCanvas({
  tool,
  color,
  strokeWidth,
  strokes = [],
  onStrokeComplete,
  onErase,
  onClear,
}) {
  const svgRef = useRef(null)
  const [currentStroke, setCurrentStroke] = useState(null)

  const getPoint = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: e.clientX, y: e.clientY }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    try {
      const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse())
      return { x: svgPt.x, y: svgPt.y }
    } catch {
      return { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handlePointerDown = useCallback(
    (e) => {
      if (tool === 'none' || tool === 'laser') return
      e.preventDefault()
      e.target.setPointerCapture(e.pointerId)
      const point = getPoint(e)
      setCurrentStroke({
        id: 'draft',
        points: [point],
        color,
        strokeWidth: tool === 'highlighter' ? 20 : strokeWidth,
      })
    },
    [tool, color, strokeWidth, getPoint]
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (!currentStroke || tool === 'none' || tool === 'laser') return
      const point = getPoint(e)
      setCurrentStroke((s) => s ? {
        ...s,
        points: [...s.points, point],
      } : null)
    },
    [currentStroke, tool, getPoint]
  )

  const handlePointerUp = useCallback(() => {
    if (currentStroke) {
      onStrokeComplete?.({ ...currentStroke })
      setCurrentStroke(null)
    }
  }, [currentStroke, onStrokeComplete])

  const pathD = (stroke) => {
    if (!stroke.points || stroke.points.length === 0) return ''
    const [first, ...rest] = stroke.points
    if (!first) return ''
    let d = `M ${first.x} ${first.y}`
    for (const p of rest) {
      d += ` L ${p.x} ${p.y}`
    }
    return d
  }

  const pointerEvents = tool === 'none' ? 'none' : 'all'

  return (
    <svg
      ref={svgRef}
      className="annotation-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: pointerEvents,
        zIndex: 99990,
        cursor: tool === 'eraser' ? 'cell' : tool === 'none' ? 'default' : 'crosshair',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {strokes.map((s) => (
        <path
          key={s.id}
          d={pathD(s)}
          stroke={s.color}
          strokeWidth={s.strokeWidth || 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={s.type === 'highlighter' ? 0.3 : 1}
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onClick={() => tool === 'eraser' && onErase?.(s.id)}
        />
      ))}
      {currentStroke && (
        <path
          d={pathD(currentStroke)}
          stroke={currentStroke.color}
          strokeWidth={currentStroke.strokeWidth}
          strokeLinecap="round"
          fill="none"
          opacity={tool === 'highlighter' ? 0.3 : 1}
        />
      )}
    </svg>
  )
}
