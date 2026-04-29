/**
 * CanvasGridOverlay — draws a dot/line grid over the slide canvas.
 * Renders only when showGrid is true.
 */
export default function CanvasGridOverlay({ showGrid, gridSize }) {
  if (!showGrid) return null

  const style = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 998,
    backgroundImage:
      'linear-gradient(to right, rgba(99,102,241,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.18) 1px, transparent 1px)',
    backgroundSize: `${gridSize}px ${gridSize}px`,
  }

  return <div style={style} aria-hidden="true" />
}
