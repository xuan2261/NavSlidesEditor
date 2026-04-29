import { Button } from '../ui'

const ZOOM_OPTIONS = [25, 50, 75, 100, 150, 200, 400]

/**
 * CanvasZoomControls — floating zoom-in/out/fit controls.
 * Props:
 *   scale             — current zoom scale
 *   onZoomIn          — () => void
 *   onZoomOut         — () => void
 *   onZoomReset       — () => void
 *   onScaleChange     — (scale) => void  (for dropdown)
 *   onSetUserZoomMode — (bool) => void
 */
export default function CanvasZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onScaleChange,
  onSetUserZoomMode,
}) {
  return (
    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-card border border-border rounded-md p-1 shadow-md z-[100]">
      <Button
        variant="icon"
        className="h-7 w-7 p-0 shrink-0 flex items-center justify-center text-lg"
        onClick={onZoomOut}
        title="Zoom out"
      >
        −
      </Button>
      <select
        className="bg-secondary border border-border text-text-primary rounded text-[11px] px-1 py-0.5 min-w-[60px] text-center outline-none cursor-pointer"
        value={`${Math.round(scale * 100)}`}
        onChange={(e) => {
          const pct = parseInt(e.target.value) / 100
          onScaleChange?.(Math.max(0.1, Math.min(4, pct)))
          onSetUserZoomMode?.(true)
        }}
      >
        {ZOOM_OPTIONS.map((pct) => (
          <option key={pct} value={pct}>{pct}%</option>
        ))}
      </select>
      <Button
        variant="icon"
        className="h-7 w-7 p-0 shrink-0 flex items-center justify-center text-lg"
        onClick={onZoomIn}
        title="Zoom in"
      >
        +
      </Button>
      <Button
        variant="ghost"
        className="text-[11px] px-2 py-1 h-7 rounded whitespace-nowrap text-text-muted hover:text-text-primary"
        onClick={onZoomReset}
        title="Fit to window"
      >
        Fit
      </Button>
    </div>
  )
}
