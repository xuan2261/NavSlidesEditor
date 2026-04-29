import { cn } from '../../lib/utils'

const SLIDE_W = 960
const SLIDE_H = 540

const topRulerStyle = {
  position: 'absolute',
  top: 0,
  left: '50%',
  transform: 'translateX(calc(-50% * 1)) scale(var(--ruler-scale, 1))',
  transformOrigin: 'top center',
  width: SLIDE_W,
  height: 20,
  zIndex: 100,
  cursor: 'crosshair',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'flex-end',
  userSelect: 'none',
  fontSize: 8,
}

function getTopRulerTickStyle(index) {
  return {
    position: 'absolute',
    left: index * 50,
    bottom: 0,
    borderLeft: '1px solid rgba(255,255,255,0.2)',
    height: '100%',
    paddingLeft: 2,
  }
}

const leftRulerStyle = {
  position: 'absolute',
  left: 0,
  top: '50%',
  transform: 'translateY(calc(-50% * 1)) scale(var(--ruler-scale, 1))',
  transformOrigin: 'left center',
  width: 20,
  height: SLIDE_H,
  zIndex: 100,
  cursor: 'crosshair',
  overflow: 'hidden',
  userSelect: 'none',
  fontSize: 8,
}

function getLeftRulerTickStyle(index) {
  return {
    position: 'absolute',
    top: index * 50,
    left: 0,
    borderTop: '1px solid rgba(255,255,255,0.2)',
    width: '100%',
    paddingLeft: 2,
    paddingTop: 1,
  }
}

/**
 * CanvasRulers — horizontal and vertical ruler bars for the slide canvas.
 * Props:
 *   scale      — current zoom scale (used for transform)
 *   onAddGuide — callback({ axis, position })
 */
export default function CanvasRulers({ scale, onAddGuide }) {
  const handleRulerMouseDown = (axis, _e) => {
    const canvasEl = document.querySelector('.slide-canvas')
    if (!canvasEl) return
    const rect = canvasEl.getBoundingClientRect()
    const onMove = () => {}
    const onUp = (me) => {
      const pos = axis === 'x'
        ? (me.clientX - rect.left) / scale
        : (me.clientY - rect.top) / scale
      if (pos >= 0 && pos <= (axis === 'x' ? SLIDE_W : SLIDE_H)) {
        onAddGuide?.({ axis, position: Math.round(pos) })
      }
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const topStyle = { ...topRulerStyle, transform: `translateX(calc(-50% * 1)) scale(${scale})` }
  const leftStyle = { ...leftRulerStyle, transform: `translateY(calc(-50% * 1)) scale(${scale})` }

  return (
    <>
      {/* Top ruler */}
      <div
        className={cn('bg-panel/90 border-b border-border text-text-muted')}
        data-testid="top-ruler"
        style={topStyle}
        onMouseDown={(e) => handleRulerMouseDown('y', e)}
      >
        {Array.from({ length: Math.ceil(SLIDE_W / 50) }, (_, i) => (
          <div key={i} style={getTopRulerTickStyle(i)}>
            {i * 50}
          </div>
        ))}
      </div>
      {/* Left ruler */}
      <div
        className={cn('bg-panel/90 border-r border-border text-text-muted')}
        data-testid="left-ruler"
        style={leftStyle}
        onMouseDown={(e) => handleRulerMouseDown('x', e)}
      >
        {Array.from({ length: Math.ceil(SLIDE_H / 50) }, (_, i) => (
          <div key={i} style={getLeftRulerTickStyle(i)}>
            {i * 50}
          </div>
        ))}
      </div>
    </>
  )
}
