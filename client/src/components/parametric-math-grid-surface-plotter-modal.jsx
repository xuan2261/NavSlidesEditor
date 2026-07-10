import { useMemo, useState } from 'react'
import {
  PRESETS,
  evalRange,
  generateGrid,
  generateMathGridSvgHtml,
} from '../data/parametric-math-grid-templates.js'
import { Button, ModalShell } from './ui'

const DEFAULT_STATE = {
  xExpr: PRESETS[0].xExpr,
  yExpr: PRESETS[0].yExpr,
  uMin: String(PRESETS[0].uMin),
  uMax: String(PRESETS[0].uMax),
  vMin: String(PRESETS[0].vMin),
  vMax: String(PRESETS[0].vMax),
  uDiv: PRESETS[0].uDiv,
  vDiv: PRESETS[0].vDiv,
  color: '#6366f1',
  lineWidth: 1.5,
  opacity: 0.8,
  showU: true,
  showV: true,
  bg: 'transparent',
}

function GridSVG({ grid, color, lineWidth, opacity, showU, showV }) {
  if (grid.error || !grid.bounds) {
    return (
      <div className="flex items-center justify-center w-full h-full text-text-muted text-xs">
        {grid.error || 'No preview'}
      </div>
    )
  }
  const { bounds, uLines, vLines } = grid
  const bw = bounds.maxX - bounds.minX || 1
  const bh = bounds.maxY - bounds.minY || 1
  const sw = (lineWidth * bw) / 400
  const lines = []
  if (showU) lines.push(...uLines)
  if (showV) lines.push(...vLines)
  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minY} ${bw} ${bh}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {lines.map((seg, i) => (
        <polyline
          key={i}
          points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          opacity={opacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

const fieldLabel = 'block text-[11px] text-text-muted mb-1'
const inputCls =
  'w-full bg-card border border-border text-text-primary px-2 py-1 rounded-sm text-xs font-mono'

export default function ParametricMathGridSurfacePlotterModal({ onInsert, onClose }) {
  const [s, setS] = useState(DEFAULT_STATE)
  const update = (k, v) => setS((prev) => ({ ...prev, [k]: v }))

  const applyPreset = (p) => {
    setS((prev) => ({
      ...prev,
      xExpr: p.xExpr,
      yExpr: p.yExpr,
      uMin: String(p.uMin),
      uMax: String(p.uMax),
      vMin: String(p.vMin),
      vMax: String(p.vMax),
      uDiv: p.uDiv,
      vDiv: p.vDiv,
    }))
  }

  const grid = useMemo(
    () =>
      generateGrid(s.xExpr, s.yExpr, {
        uMin: evalRange(s.uMin),
        uMax: evalRange(s.uMax),
        vMin: evalRange(s.vMin),
        vMax: evalRange(s.vMax),
        uDiv: +s.uDiv || 0,
        vDiv: +s.vDiv || 0,
      }),
    [s.xExpr, s.yExpr, s.uMin, s.uMax, s.vMin, s.vMax, s.uDiv, s.vDiv]
  )

  const handleInsert = () => {
    if (grid.error) return
    onInsert(
      generateMathGridSvgHtml(grid, {
        color: s.color,
        lineWidth: s.lineWidth,
        opacity: s.opacity,
        showU: s.showU,
        showV: s.showV,
        bg: s.bg,
      })
    )
    onClose()
  }

  const ranges = [
    ['uMin', 'u min'],
    ['uMax', 'u max'],
    ['vMin', 'v min'],
    ['vMax', 'v max'],
  ]

  return (
    <ModalShell
      title="Math Grid"
      titleId="math-grid-modal-title"
      size="2xl"
      className="w-[820px] max-h-[85vh]"
      bodyClassName="flex-1 p-0 overflow-hidden"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="px-4 py-1.5 text-sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="px-4 py-1.5 text-sm"
            onClick={handleInsert}
            disabled={!!grid.error}
          >
            Insert
          </Button>
        </div>
      }
    >
      <div className="flex h-full overflow-hidden">
        <div className="w-40 border-r border-border overflow-y-auto p-2">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className="w-full text-left px-3 py-2 rounded text-sm mb-1 cursor-pointer hover:bg-hover text-text-primary"
              onClick={() => applyPreset(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className={fieldLabel}>X(u,v)</div>
              <input
                aria-label="X expression"
                className={inputCls}
                value={s.xExpr}
                onChange={(e) => update('xExpr', e.target.value)}
              />
            </div>
            <div>
              <div className={fieldLabel}>Y(u,v)</div>
              <input
                aria-label="Y expression"
                className={inputCls}
                value={s.yExpr}
                onChange={(e) => update('yExpr', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {ranges.map(([k, l]) => (
              <div key={k}>
                <div className={fieldLabel}>{l}</div>
                <input
                  aria-label={l}
                  className={inputCls}
                  value={s[k]}
                  onChange={(e) => update(k, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className={fieldLabel}>u divisions</div>
              <input
                aria-label="u divisions"
                type="number"
                min={1}
                className={inputCls}
                value={s.uDiv}
                onChange={(e) => update('uDiv', +e.target.value)}
              />
            </div>
            <div>
              <div className={fieldLabel}>v divisions</div>
              <input
                aria-label="v divisions"
                type="number"
                min={1}
                className={inputCls}
                value={s.vDiv}
                onChange={(e) => update('vDiv', +e.target.value)}
              />
            </div>
            <div>
              <div className={fieldLabel}>Line width</div>
              <input
                aria-label="Line width"
                type="number"
                min={0.1}
                step={0.1}
                className={inputCls}
                value={s.lineWidth}
                onChange={(e) => update('lineWidth', +e.target.value)}
              />
            </div>
            <div>
              <div className={fieldLabel}>Opacity</div>
              <input
                aria-label="Opacity"
                type="number"
                min={0}
                max={1}
                step={0.05}
                className={inputCls}
                value={s.opacity}
                onChange={(e) => update('opacity', +e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 items-end">
            <div>
              <div className={fieldLabel}>Color</div>
              <input
                aria-label="Color"
                type="color"
                className="w-full h-7 border border-border rounded cursor-pointer"
                value={s.color}
                onChange={(e) => update('color', e.target.value)}
              />
            </div>
            <div>
              <div className={fieldLabel}>Background</div>
              <input
                aria-label="Background"
                type="color"
                className="w-full h-7 border border-border rounded cursor-pointer"
                value={s.bg === 'transparent' ? '#000000' : s.bg}
                onChange={(e) => update('bg', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3 pb-1">
              <label className="flex items-center gap-1 text-[11px] text-text-primary">
                <input
                  aria-label="Show u lines"
                  type="checkbox"
                  checked={s.showU}
                  onChange={(e) => update('showU', e.target.checked)}
                />
                u-lines
              </label>
              <label className="flex items-center gap-1 text-[11px] text-text-primary">
                <input
                  aria-label="Show v lines"
                  type="checkbox"
                  checked={s.showV}
                  onChange={(e) => update('showV', e.target.checked)}
                />
                v-lines
              </label>
            </div>
          </div>
          {grid.error && (
            <div
              className="text-xs text-red-500 border border-red-500/40 bg-red-500/10 px-2 py-1 rounded"
              role="alert"
            >
              {grid.error}
            </div>
          )}
        </div>
        <div className="w-72 border-l border-border p-3 flex items-center justify-center bg-black/20">
          <GridSVG
            grid={grid}
            color={s.color}
            lineWidth={s.lineWidth}
            opacity={s.opacity}
            showU={s.showU}
            showV={s.showV}
          />
        </div>
      </div>
    </ModalShell>
  )
}
