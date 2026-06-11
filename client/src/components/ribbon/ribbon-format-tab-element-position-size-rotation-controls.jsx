import {
  Lock, Unlock, RotateCw, AlignStartVertical, AlignHorizontalJustifyCenter, AlignEndVertical,
} from 'lucide-react'
import RibbonSection from './ribbon-section'
import RibbonTabContentRow from './ribbon-tab-content-row'
import { Button } from '../ui'
import { CANVAS_WIDTH } from '../../data/slide-constants'
import { normalizeTableShape } from '../properties/table-properties-utils'
import { normalizeRotation } from '../../utils/element-update-fanout'
import { computeMixedValues } from '../../utils/selection-mixed-values'

const OBJECT_FIT_OPTIONS = ['cover', 'contain', 'fill', 'none']
const CHART_TYPES = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', 'scatter']
const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
  'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'html', 'css',
  'sql', 'bash', 'json', 'yaml', 'xml', 'markdown',
]

function ShapeControls({ element, onUpdateElement }) {
  return (
    <>
      {element.type !== 'line' && (
        <RibbonSection label="Fill" className="border-r border-border">
          <div className="flex items-center h-7">
            <input
              type="color"
              className="w-7 h-7 rounded cursor-pointer border border-border"
              value={element.fill || '#6366f1'}
              onChange={(e) => onUpdateElement?.({ fill: e.target.value })}
              aria-label="Fill color"
            />
          </div>
        </RibbonSection>
      )}
      <RibbonSection label="Stroke" className="border-r border-border">
        <div className="flex items-center gap-1 h-7">
          <input
            type="color"
            className="w-7 h-7 rounded cursor-pointer border border-border"
            value={element.stroke || '#000000'}
            onChange={(e) => onUpdateElement?.({ stroke: e.target.value })}
            aria-label="Stroke color"
          />
          <input
            type="number"
            className="w-10 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
            value={element.strokeWidth ?? 0}
            onChange={(e) => onUpdateElement?.({ strokeWidth: Math.max(0, parseInt(e.target.value) || 0) })}
            min={0}
            aria-label="Stroke width"
          />
        </div>
      </RibbonSection>
    </>
  )
}

function ImageControls({ element, onUpdateElement }) {
  return (
    <>
      <RibbonSection label="Fit" className="border-r border-border">
        <select
          className="h-7 bg-card border border-border text-text-primary px-1.5 rounded text-xs cursor-pointer"
          value={element.objectFit || 'cover'}
          onChange={(e) => onUpdateElement?.({ objectFit: e.target.value })}
          aria-label="Object fit"
        >
          {OBJECT_FIT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </RibbonSection>
      <RibbonSection label="Alt Text" className="border-r border-border">
        <input
          type="text"
          className="w-24 h-7 rounded border border-border bg-secondary px-1.5 text-[11px] text-text-primary focus:border-accent focus:outline-none"
          value={element.alt || ''}
          onChange={(e) => onUpdateElement?.({ alt: e.target.value })}
          placeholder="Alt text"
          aria-label="Alt text"
        />
      </RibbonSection>
    </>
  )
}

function ChartControls({ element, onUpdateElement }) {
  return (
    <RibbonSection label="Chart Type" className="border-r border-border">
      <select
        className="h-7 bg-card border border-border text-text-primary px-1.5 rounded text-xs cursor-pointer"
        value={element.chartType || 'bar'}
        onChange={(e) => onUpdateElement?.({ chartType: e.target.value })}
        aria-label="Chart type"
      >
        {CHART_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </RibbonSection>
  )
}

function TableControls({ element, onUpdateElement }) {
  const data = element.data || [['']]
  const rowCount = data.length
  const colCount = Math.max(1, ...data.map((row) => (row || []).length))

  const resizeData = (rows, cols) => {
    const nextData = Array.from({ length: rows }, (_, rowIndex) => {
      const sourceRow = data[rowIndex] || []
      return Array.from({ length: cols }, (_, colIndex) => sourceRow[colIndex] ?? '')
    })
    onUpdateElement?.(normalizeTableShape({ data: nextData }, element))
  }

  const updateNum = (kind, value) => {
    const num = parseInt(value, 10)
    if (Number.isNaN(num) || num < 1) return
    if (kind === 'rows') resizeData(num, colCount)
    if (kind === 'cols') resizeData(rowCount, num)
  }

  return (
    <RibbonSection label="Table" className="border-r border-border">
      <div className="flex items-center gap-1 h-7">
        <label className="flex items-center gap-0.5">
          <span className="text-[10px] text-text-muted">R</span>
          <input
            type="number"
            className="w-10 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
            value={rowCount}
            onChange={(e) => updateNum('rows', e.target.value)}
            min={1}
            aria-label="Rows"
          />
        </label>
        <label className="flex items-center gap-0.5">
          <span className="text-[10px] text-text-muted">C</span>
          <input
            type="number"
            className="w-10 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
            value={colCount}
            onChange={(e) => updateNum('cols', e.target.value)}
            min={1}
            aria-label="Columns"
          />
        </label>
      </div>
    </RibbonSection>
  )
}

function VideoControls({ element, onUpdateElement }) {
  return (
    <RibbonSection label="Source" className="border-r border-border">
      <input
        type="text"
        className="w-32 h-7 rounded border border-border bg-secondary px-1.5 text-[11px] text-text-primary focus:border-accent focus:outline-none"
        value={element.src || ''}
        onChange={(e) => onUpdateElement?.({ src: e.target.value })}
        placeholder="Video URL"
        aria-label="Source URL"
      />
    </RibbonSection>
  )
}

function CodeControls({ element, onUpdateElement }) {
  return (
    <RibbonSection label="Language" className="border-r border-border">
      <select
        className="h-7 bg-card border border-border text-text-primary px-1.5 rounded text-xs cursor-pointer max-w-[100px]"
        value={element.language || 'javascript'}
        onChange={(e) => onUpdateElement?.({ language: e.target.value })}
        aria-label="Language"
      >
        {CODE_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>{lang}</option>
        ))}
      </select>
    </RibbonSection>
  )
}

function ContextualControls({ selectedElement, onUpdateElement }) {
  if (!selectedElement) return null

  switch (selectedElement.type) {
    case 'shape':
    case 'line':
      return <ShapeControls element={selectedElement} onUpdateElement={onUpdateElement} />
    case 'image':
      return <ImageControls element={selectedElement} onUpdateElement={onUpdateElement} />
    case 'chart':
      return <ChartControls element={selectedElement} onUpdateElement={onUpdateElement} />
    case 'table':
      return <TableControls element={selectedElement} onUpdateElement={onUpdateElement} />
    case 'video':
    case 'audio':
      return <VideoControls element={selectedElement} onUpdateElement={onUpdateElement} />
    case 'code':
      return <CodeControls element={selectedElement} onUpdateElement={onUpdateElement} />
    default:
      return null
  }
}

export default function FormatTabContent({ selectedElement, onUpdateElement, elements, selectedElementIds }) {
  if (!selectedElement) {
    return (
      <RibbonTabContentRow>
        <RibbonSection label="Selection">
          <span className="text-[11px] text-text-muted whitespace-nowrap">
            Select an element to format
          </span>
        </RibbonSection>
      </RibbonTabContentRow>
    )
  }

  // X/Y accept negatives (off-canvas bleed is valid) — no lower bound. Rotation
  // wraps to 0–359 so the ribbon and the Properties panel agree. W/H keep a
  // floor of 1 here; the apply path enforces the real minimum size.
  const updateNum = (key, value, min = null) => {
    const num = parseInt(value, 10)
    if (Number.isNaN(num)) return
    if (key === 'rotation') {
      onUpdateElement?.({ rotation: normalizeRotation(num) })
      return
    }
    if (min !== null && num < min) return
    onUpdateElement?.({ [key]: num })
  }

  const mixed = computeMixedValues(elements || [], selectedElementIds || [], [
    'x',
    'y',
    'width',
    'height',
    'rotation',
    'opacity',
  ])
  const opacityMixed = mixed.opacity?.isMixed
  // Blank a geometry field + show its placeholder when the selection diverges on
  // that key (parity with the Properties panel). Editing still writes — the apply
  // path fans the value to every selected element.
  const numProps = (key, fallback) =>
    mixed[key]?.isMixed ? { value: '', placeholder: '—' } : { value: fallback }

  return (
    <RibbonTabContentRow>
      <ContextualControls selectedElement={selectedElement} onUpdateElement={onUpdateElement} />

      <RibbonSection label="Position" className="border-r border-border">
        <div className="flex items-center gap-1 h-7">
          <label className="flex items-center gap-0.5">
            <span className="text-[10px] text-text-muted w-3">X</span>
            <input type="number"
              className="w-12 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
              {...numProps('x', Math.round(selectedElement.x || 0))}
              onChange={(e) => updateNum('x', e.target.value)}
              aria-label="X position" />
          </label>
          <label className="flex items-center gap-0.5">
            <span className="text-[10px] text-text-muted w-3">Y</span>
            <input type="number"
              className="w-12 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
              {...numProps('y', Math.round(selectedElement.y || 0))}
              onChange={(e) => updateNum('y', e.target.value)}
              aria-label="Y position" />
          </label>
        </div>
      </RibbonSection>

      <RibbonSection label="Size" className="border-r border-border">
        <div className="flex items-center gap-1 h-7">
          <label className="flex items-center gap-0.5">
            <span className="text-[10px] text-text-muted w-3">W</span>
            <input type="number"
              className="w-12 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
              {...numProps('width', Math.round(selectedElement.width || 0))}
              onChange={(e) => updateNum('width', e.target.value, 1)}
              aria-label="Width" />
          </label>
          <label className="flex items-center gap-0.5">
            <span className="text-[10px] text-text-muted w-3">H</span>
            <input type="number"
              className="w-12 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
              {...numProps('height', Math.round(selectedElement.height || 0))}
              onChange={(e) => updateNum('height', e.target.value, 1)}
              aria-label="Height" />
          </label>
        </div>
      </RibbonSection>

      <RibbonSection label="Rotate" className="border-r border-border">
        <div className="flex items-center gap-0.5 h-7">
          <input type="number"
            className="w-12 h-7 rounded border border-border bg-secondary px-1 text-[11px] text-text-primary text-center focus:border-accent focus:outline-none"
            {...numProps('rotation', Math.round(selectedElement.rotation || 0))}
            onChange={(e) => updateNum('rotation', e.target.value)}
            aria-label="Rotation degrees" />
          <Button variant="icon" className="h-7 w-7"
            title="Rotate 90°" aria-label="Rotate 90 degrees"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdateElement?.({ rotation: ((selectedElement.rotation || 0) + 90) % 360 })
            }}>
            <RotateCw size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Opacity" className="border-r border-border">
        <div className="flex items-center gap-1 h-7">
          <input
            type="range"
            data-mixed={opacityMixed ? 'true' : undefined}
            className="w-16 accent-accent cursor-pointer"
            min={0}
            max={1}
            step={0.05}
            value={selectedElement.opacity ?? 1}
            onChange={(e) => onUpdateElement?.({ opacity: parseFloat(e.target.value) })}
            aria-label="Opacity"
          />
          <span className="text-[10px] text-text-muted w-6 text-right">
            {opacityMixed ? '—' : `${Math.round((selectedElement.opacity ?? 1) * 100)}%`}
          </span>
        </div>
      </RibbonSection>

      <RibbonSection label="Align" className="border-r border-border">
        <div className="flex items-center gap-0.5">
          <Button variant="icon" className="h-7 w-7"
            title="Align left" aria-label="Align left"
            onMouseDown={(e) => { e.preventDefault(); onUpdateElement?.({ x: 0 }) }}>
            <AlignStartVertical size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7"
            title="Align center" aria-label="Align center horizontal"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdateElement?.({ x: Math.round((CANVAS_WIDTH - (selectedElement.width || 0)) / 2) })
            }}>
            <AlignHorizontalJustifyCenter size={14} />
          </Button>
          <Button variant="icon" className="h-7 w-7"
            title="Align right" aria-label="Align right"
            onMouseDown={(e) => {
              e.preventDefault()
              onUpdateElement?.({ x: Math.round(CANVAS_WIDTH - (selectedElement.width || 0)) })
            }}>
            <AlignEndVertical size={14} />
          </Button>
        </div>
      </RibbonSection>

      <RibbonSection label="Properties">
        <Button variant="ribbon"
          className={selectedElement.locked ? 'bg-primary-light text-accent' : ''}
          title={selectedElement.locked ? 'Unlock element' : 'Lock element'}
          aria-label="Toggle lock"
          aria-pressed={!!selectedElement.locked}
          onMouseDown={(e) => {
            e.preventDefault()
            onUpdateElement?.({ locked: !selectedElement.locked })
          }}>
          {selectedElement.locked ? <Lock size={14} /> : <Unlock size={14} />}
          <span className="hidden lg:inline">{selectedElement.locked ? 'Locked' : 'Lock'}</span>
        </Button>
      </RibbonSection>
    </RibbonTabContentRow>
  )
}
