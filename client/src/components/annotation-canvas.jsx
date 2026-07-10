import React, { useRef, useState, useCallback, useEffect } from 'react'

const DRAWING_TOOLS = new Set(['pen', 'highlighter'])

export function AnnotationCanvas({
  tool,
  color,
  strokeWidth,
  strokes = [],
  onStrokeComplete,
  onErase,
  onLaserChange,
  _onClear,
}) {
  const svgRef = useRef(null)
  const laserActiveRef = useRef(false)
  const lastLaserPointRef = useRef(null)
  const [currentStroke, setCurrentStroke] = useState(null)

  const getPoint = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return { x: 0, y: 0 }
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    }
  }, [])

  const handlePointerDown = useCallback(
    (e) => {
      if (tool === 'none') return
      e.preventDefault()
      e.target.setPointerCapture(e.pointerId)
      const point = getPoint(e)
      if (tool === 'laser') {
        laserActiveRef.current = true
        lastLaserPointRef.current = point
        onLaserChange?.({ ...point, active: true })
        return
      }
      if (!DRAWING_TOOLS.has(tool)) return
      setCurrentStroke({
        id: 'draft',
        points: [point],
        color,
        strokeWidth: tool === 'highlighter' ? 20 : strokeWidth,
        type: tool === 'highlighter' ? 'highlighter' : 'path',
        coordinateSpace: 'normalized',
      })
    },
    [tool, color, strokeWidth, getPoint, onLaserChange]
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (tool === 'laser') {
        if (!laserActiveRef.current) return
        const point = getPoint(e)
        lastLaserPointRef.current = point
        onLaserChange?.({ ...point, active: true })
        return
      }
      if (!currentStroke || !DRAWING_TOOLS.has(tool)) return
      const point = getPoint(e)
      setCurrentStroke((s) => s ? {
        ...s,
        points: [...s.points, point],
      } : null)
    },
    [currentStroke, tool, getPoint, onLaserChange]
  )

  const deactivateLaser = useCallback(() => {
    if (!laserActiveRef.current) return
    laserActiveRef.current = false
    onLaserChange?.({ ...(lastLaserPointRef.current || { x: 0, y: 0 }), active: false })
  }, [onLaserChange])

  const handlePointerUp = useCallback(() => {
    if (tool === 'laser') {
      deactivateLaser()
      return
    }
    if (currentStroke && DRAWING_TOOLS.has(tool)) {
      onStrokeComplete?.({ ...currentStroke })
    }
    setCurrentStroke(null)
  }, [currentStroke, deactivateLaser, onStrokeComplete, tool])

  useEffect(() => {
    if (tool !== 'laser') deactivateLaser()
    return deactivateLaser
  }, [deactivateLaser, tool])

  const pathD = (stroke) => {
    if (stroke.d) return stroke.d
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
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
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
          vectorEffect="non-scaling-stroke"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onClick={() => tool === 'eraser' && onErase?.(s.id)}
        />
      ))}
      {currentStroke && DRAWING_TOOLS.has(tool) && (
        <path
          d={pathD(currentStroke)}
          stroke={currentStroke.color}
          strokeWidth={currentStroke.strokeWidth}
          strokeLinecap="round"
          fill="none"
          opacity={tool === 'highlighter' ? 0.3 : 1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}
