import { useState } from 'react'
import { Play, X, GripVertical } from 'lucide-react'
import { Button } from '../components/ui'
import { FRAGMENT_ANIMATION_TYPES } from '../constants/fragment-animation-types'

const ANIMATION_TYPES = FRAGMENT_ANIMATION_TYPES

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
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => setDragItem(null)

  const handleDrop = (e, toIndex) => {
    e.preventDefault()
    if (!dragItem) return
    const sourceEl = (slide.elements || []).find((el) => el.id === dragItem.elementId)
    const updates = { fragmentIndex: toIndex }
    if (sourceEl && !sourceEl.fragment) updates.fragment = true
    onUpdateElement(dragItem.elementId, updates)
    setDragItem(null)
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[990] bg-card border-t border-border max-h-[200px] flex flex-col">
      <div className="flex items-center gap-2.5 py-2 px-3 border-b border-border shrink-0">
        <span className="font-semibold text-[13px]">Animation Timeline</span>
        <span className="text-[11px] text-text-muted">
          {fragmentElements.length} animated element{fragmentElements.length !== 1 ? 's' : ''}
        </span>
        <div className="ml-auto flex gap-1.5">
          {onPreview && (
            <Button
              variant="secondary"
              className="text-[11px] px-2.5 py-0.5"
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

      {fragmentElements.length === 0 ? (
        <div
          data-testid="animation-timeline-empty-state"
          className="flex-1 flex flex-col items-center justify-center px-3 py-4 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, 1)}
        >
          <div className="text-[12px] text-text-primary mb-1">
            No animated elements on this slide yet
          </div>
          <div className="text-[11px] text-text-muted max-w-[420px]">
            Drag any element below into a step, or open the Animations tab and toggle the
            animation switch to add a fragment.
          </div>
          <div className="mt-2 flex flex-wrap gap-1 justify-center max-w-[520px]">
            {nonFragElements.slice(0, 8).map((el) => (
              <div
                key={el.id}
                data-testid={`animation-timeline-item-${el.id}`}
                className="flex items-center gap-1 py-1 px-2 rounded border border-dashed border-border text-[11px] text-text-primary bg-white/[0.06] cursor-grab"
                draggable
                onDragStart={(e) => handleDragStart(e, el.id, 0)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical size={10} className="cursor-grab opacity-50" />
                {getElementLabel(el)}
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div className="flex overflow-x-auto py-2.5 px-3 gap-2 flex-1">
        {/* Initial state (non-fragment elements) */}
        <div className="min-w-[140px] bg-secondary border border-border rounded-sm p-2 shrink-0">
          <div className="text-[11px] font-semibold text-text-muted mb-1.5">Initial</div>
          <div className="flex flex-col gap-1">
            {nonFragElements.slice(0, 5).map((el) => (
              <div
                key={el.id}
                data-testid={`animation-timeline-item-${el.id}`}
                className="flex items-center gap-1 py-1 px-2 rounded border border-border text-[11px] cursor-grab text-text-primary bg-white/[0.08]"
                draggable
                onDragStart={(e) => handleDragStart(e, el.id, 0)}
                onDragEnd={handleDragEnd}
                title="Drag onto a step to animate this element"
              >
                <GripVertical size={10} className="cursor-grab opacity-50" />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {getElementLabel(el)}
                </span>
              </div>
            ))}
            {nonFragElements.length > 5 && (
              <span className="text-[10px] text-text-muted">
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
                  data-testid={`animation-timeline-item-${el.id}`}
                  className="flex items-center gap-1 py-1 px-2 rounded border border-border text-[11px] cursor-grab text-text-primary"
                  draggable
                  onDragStart={(e) => handleDragStart(e, el.id, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    background: ELEMENT_COLORS[i % ELEMENT_COLORS.length] + '33',
                    borderColor: ELEMENT_COLORS[i % ELEMENT_COLORS.length],
                  }}
                >
                  <GripVertical size={10} className="cursor-grab opacity-50" />
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
          data-testid="animation-timeline-newstep-dropzone"
          className="min-w-[140px] bg-transparent border-2 border-dashed border-border rounded-sm p-2 shrink-0 flex items-center justify-center gap-1.5"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, maxIndex + 1)}
        >
          <div
            className="text-[11px] font-semibold text-text-muted mb-1.5 opacity-40"
          >
            +
          </div>
          <span className="text-[11px] text-text-muted">Drop here for new step</span>
        </div>
      </div>
      )}
    </div>
  )
}
