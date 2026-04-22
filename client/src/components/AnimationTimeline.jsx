import { useState } from 'react'
import { Play, X, GripVertical } from 'lucide-react'
import { Button } from '../components/ui'

const ANIMATION_TYPES = [
  { value: 'fade-in', label: 'Fade In' },
  { value: 'fade-out', label: 'Fade Out' },
  { value: 'fade-up', label: 'Fade Up' },
  { value: 'fade-down', label: 'Fade Down' },
  { value: 'fade-left', label: 'Fade Left' },
  { value: 'fade-right', label: 'Fade Right' },
  { value: 'grow', label: 'Grow' },
  { value: 'shrink', label: 'Shrink' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'highlight-red', label: 'Highlight Red' },
  { value: 'highlight-green', label: 'Highlight Green' },
  { value: 'highlight-blue', label: 'Highlight Blue' },
]

const ELEMENT_COLORS = [
  '#6366f1',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#06b6d4',
]

function getElementLabel(el) {
  if (el.type === 'text') {
    const doc = new DOMParser().parseFromString(el.content || '', 'text/html')
    const text = (doc.body.textContent || '').slice(0, 30)
    return text || 'Text'
  }
  if (el.type === 'image') return 'Image'
  if (el.type === 'shape') return el.shape || 'Shape'
  if (el.type === 'code') return `Code (${el.language || 'text'})`
  if (el.type === 'html') return 'HTML Embed'
  if (el.type === 'video') return 'Video'
  if (el.type === 'audio') return 'Audio'
  if (el.type === 'table') return 'Table'
  return el.type
}

export default function AnimationTimeline({ slide, onUpdateElement, onClose, onPreview }) {
  const [dragItem, setDragItem] = useState(null)

  if (!slide) return null

  const fragmentElements = (slide.elements || [])
    .filter((el) => el.fragment)
    .sort((a, b) => (a.fragmentIndex || 1) - (b.fragmentIndex || 1))

  const nonFragElements = (slide.elements || []).filter((el) => !el.fragment)

  // Group by fragment index
  const groups = {}
  fragmentElements.forEach((el) => {
    const idx = el.fragmentIndex || 1
    if (!groups[idx]) groups[idx] = []
    groups[idx].push(el)
  })
  const sortedIndices = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
  const maxIndex = sortedIndices.length > 0 ? Math.max(...sortedIndices) : 0

  const handleDragStart = (e, elementId, fromIndex) => {
    setDragItem({ elementId, fromIndex })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    if (dragItem) {
      onUpdateElement(dragItem.elementId, { fragmentIndex: toIndex })
      setDragItem(null)
    }
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[990] bg-card border-t border-border max-h-[200px] flex flex-col">
      <div className="flex items-center gap-2.5 py-2 px-3 border-b border-border shrink-0">
        <span style={{ fontWeight: 600, fontSize: 13 }}>Animation Timeline</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {fragmentElements.length} animated element{fragmentElements.length !== 1 ? 's' : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {onPreview && (
            <Button
              variant="secondary"
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={onPreview}
            >
              <Play size={12} /> Preview
            </Button>
          )}
          <Button variant="icon" onClick={onClose} title="Close timeline">
            <X size={14} />
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto py-2.5 px-3 gap-2 flex-1">
        {/* Initial state (non-fragment elements) */}
        <div className="min-w-[140px] bg-secondary border border-border rounded-sm p-2 shrink-0">
          <div className="text-[11px] font-semibold text-text-muted mb-1.5">Initial</div>
          <div className="flex flex-col gap-1">
            {nonFragElements.slice(0, 5).map((el) => (
              <div
                key={el.id}
                className="flex items-center gap-1 py-1 px-2 rounded border border-border text-[11px] cursor-grab text-text-primary"
                style={{ background: 'rgba(255,255,255,0.08)', opacity: 0.5 }}
              >
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {getElementLabel(el)}
                </span>
              </div>
            ))}
            {nonFragElements.length > 5 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                +{nonFragElements.length - 5} more
              </span>
            )}
          </div>
        </div>

        {/* Fragment steps */}
        {sortedIndices.map((idx) => (
          <div
            key={idx}
            className="min-w-[140px] bg-secondary border border-border rounded-sm p-2 shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, idx)}
          >
            <div className="text-[11px] font-semibold text-text-muted mb-1.5">Step {idx}</div>
            <div className="flex flex-col gap-1">
              {groups[idx].map((el, i) => (
                <div
                  key={el.id}
                  className="flex items-center gap-1 py-1 px-2 rounded border border-border text-[11px] cursor-grab text-text-primary"
                  draggable
                  onDragStart={(e) => handleDragStart(e, el.id, idx)}
                  style={{
                    background: ELEMENT_COLORS[i % ELEMENT_COLORS.length] + '33',
                    borderColor: ELEMENT_COLORS[i % ELEMENT_COLORS.length],
                  }}
                >
                  <GripVertical size={10} style={{ cursor: 'grab', opacity: 0.5 }} />
                  <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {getElementLabel(el)}
                  </span>
                  <select
                    value={el.fragmentAnimation || 'fade-in'}
                    onChange={(e) => onUpdateElement(el.id, { fragmentAnimation: e.target.value })}
                    className="bg-card border border-border text-text-primary py-0.5 px-1 rounded-sm text-[10px] cursor-pointer max-w-[80px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ANIMATION_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Drop zone for new step */}
        <div
          className="min-w-[140px] bg-transparent border-2 border-dashed border-border rounded-sm p-2 shrink-0 flex items-center justify-center gap-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, maxIndex + 1)}
        >
          <div
            className="text-[11px] font-semibold text-text-muted mb-1.5"
            style={{ opacity: 0.4 }}
          >
            +
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Drop here for new step</span>
        </div>
      </div>
    </div>
  )
}
