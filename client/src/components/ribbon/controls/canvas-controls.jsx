import { Grid3x3, Magnet, Ruler, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Button } from '../../ui'
import { useEditorStore } from '../../../stores/editor-store'

const clampGridSize = (value) => Math.min(120, Math.max(5, parseInt(value, 10) || 40))

export default function CanvasControls({ onGridSizeChange }) {
  const showGrid = useEditorStore((s) => s.showGrid)
  const setShowGrid = useEditorStore((s) => s.setShowGrid)
  const gridSize = useEditorStore((s) => s.gridSize)
  const setGridSize = useEditorStore((s) => s.setGridSize)
  const smartGuidesEnabled = useEditorStore((s) => s.smartGuidesEnabled)
  const setSmartGuidesEnabled = useEditorStore((s) => s.setSmartGuidesEnabled)
  const showRulers = useEditorStore((s) => s.showRulers)
  const setShowRulers = useEditorStore((s) => s.setShowRulers)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const updateGridSize = (value) => {
    const next = clampGridSize(value)
    setGridSize(next)
    onGridSizeChange?.(next)
  }

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="icon"
        className={`h-7 w-7 ${showGrid ? 'bg-primary-light text-accent' : ''}`}
        onClick={() => setShowGrid(!showGrid)}
        title="Toggle grid"
        aria-label="Toggle grid"
        aria-pressed={showGrid}
      >
        <Grid3x3 size={14} />
      </Button>
      <input
        type="number"
        min={5}
        max={120}
        step={5}
        className="h-7 w-12 rounded border border-border bg-card px-1 text-center text-[11px] text-text-primary outline-none focus:border-accent"
        value={gridSize || 40}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => updateGridSize(e.target.value)}
        title="Grid size"
        aria-label="Grid size"
      />
      <Button
        variant="icon"
        data-testid="canvas-controls-toggle-smart-guides"
        className={`h-7 w-7 ${smartGuidesEnabled ? 'bg-primary-light text-accent' : ''}`}
        onClick={() => setSmartGuidesEnabled(!smartGuidesEnabled)}
        title="Toggle smart guides"
        aria-label="Toggle smart guides"
        aria-pressed={smartGuidesEnabled}
      >
        <Magnet size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${showRulers ? 'bg-primary-light text-accent' : ''}`}
        onClick={() => setShowRulers(!showRulers)}
        title="Toggle rulers"
        aria-label="Toggle rulers"
        aria-pressed={showRulers}
      >
        <Ruler size={14} />
      </Button>

      <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />

      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={() => setZoom(Math.min((zoom || 1) + 0.1, 3))}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <ZoomIn size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={() => setZoom(Math.max((zoom || 1) - 0.1, 0.2))}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <ZoomOut size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onClick={() => setZoom(1)}
        title="Reset zoom"
        aria-label="Reset zoom"
      >
        <Maximize size={14} />
      </Button>
    </div>
  )
}
