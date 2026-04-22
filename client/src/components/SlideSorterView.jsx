import { useState } from 'react'
import { X, Copy, Trash2 } from 'lucide-react'
import { Button } from '../components/ui'

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: '#1e1e2e' }
  if (bg.type === 'color') return { backgroundColor: bg.color || '#1e1e2e' }
  if (bg.type === 'gradient') return { background: bg.gradient || '#1e1e2e' }
  if (bg.type === 'image' && bg.image)
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: 0.5,
    }
  return { backgroundColor: '#1e1e2e' }
}

function MiniPreview({ slide }) {
  const els = (slide.elements || []).slice(0, 4)
  return (
    <div className="sorter-slide-preview" style={getBgStyle(slide.background)}>
      {els.map((el, i) => (
        <div
          key={el.id || i}
          style={{
            position: 'absolute',
            left: `${(el.x / 1280) * 100}%`,
            top: `${(el.y / 720) * 100}%`,
            width: `${((el.width ?? 100) / 1280) * 100}%`,
            height: `${((el.height ?? 40) / 720) * 100}%`,
            fontSize: 4,
            overflow: 'hidden',
            color: 'var(--text)',
            pointerEvents: 'none',
            zIndex: el.zIndex ?? 1,
          }}
        >
          {el.type === 'text' && (
            <span
              dangerouslySetInnerHTML={{
                __html: (el.content || '').replace(/<[^>]+>/g, ' ').slice(0, 20),
              }}
            />
          )}
          {el.type === 'image' && <span style={{ opacity: 0.4 }}>🖼</span>}
          {el.type === 'html' && <span style={{ opacity: 0.4 }}>&lt;/&gt;</span>}
          {el.type === 'code' && <span style={{ opacity: 0.4 }}>⌨</span>}
          {el.type === 'latex' && <span style={{ opacity: 0.4 }}>∑</span>}
          {!['text', 'image', 'html', 'code', 'latex'].includes(el.type) && (
            <span style={{ opacity: 0.3 }}>{el.type}</span>
          )}
        </div>
      ))}
    </div>
  )
}

export default function SlideSorterView({
  slides,
  currentIndex,
  onSelect,
  onMove,
  onDelete,
  onDuplicate,
  onClose,
}) {
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [selectedIndices, setSelectedIndices] = useState([currentIndex])

  const handleDragStart = (e, idx) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx !== null && dragIdx !== idx) {
      onMove(dragIdx, idx)
    }
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const handleContextMenu = (e, idx) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, slideIdx: idx })
  }

  // Multi-select + navigate on click
  const handleCardClick = (e, idx) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      )
    } else if (e.shiftKey && selectedIndices.length > 0) {
      // Range select
      const last = selectedIndices[selectedIndices.length - 1]
      const start = Math.min(last, idx)
      const end = Math.max(last, idx)
      setSelectedIndices(Array.from({ length: end - start + 1 }, (_, i) => start + i))
    } else {
      // Single select + navigate to normal view
      setSelectedIndices([idx])
      onSelect(idx)
    }
  }

  // Close context menu on outside click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) setCtxMenu(null)
  }

  return (
    <div
      className="slide-sorter-overlay"
      onClick={(e) => {
        setCtxMenu(null)
        handleOverlayClick(e)
      }}
    >
      <div className="slide-sorter-header">
        <span>Slide Sorter</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Ctrl+Click: multi-select &nbsp;|&nbsp; Drag: reorder &nbsp;|&nbsp; Right-click:
            Duplicate/Delete
          </span>
          <Button variant="icon" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="slide-sorter-grid">
        {slides.map((slide, idx) => {
          const isCurrent = idx === currentIndex
          const isDragging = dragIdx === idx
          const isOver = dragOverIdx === idx && dragIdx !== idx
          const isMultiSelected = selectedIndices.includes(idx) && idx !== currentIndex

          return (
            <div
              key={slide.id || idx}
              className={`sorter-slide-card ${isCurrent ? 'current' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''} ${isMultiSelected ? 'multi-selected' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={(e) => handleCardClick(e, idx)}
              onContextMenu={(e) => handleContextMenu(e, idx)}
              title={`Slide ${idx + 1}`}
            >
              <div className="sorter-slide-number">{idx + 1}</div>
              <MiniPreview slide={slide} />
            </div>
          )
        })}
      </div>

      {ctxMenu && (
        <div
          className="slide-context-menu"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            onClick={() => {
              onDuplicate(ctxMenu.slideIdx)
              setCtxMenu(null)
            }}
          >
            <Copy size={12} /> Duplicate
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (slides.length > 1) onDelete(ctxMenu.slideIdx)
              setCtxMenu(null)
            }}
            style={{ color: slides.length > 1 ? 'var(--danger)' : undefined }}
            disabled={slides.length <= 1}
          >
            <Trash2 size={12} /> Delete
          </Button>
        </div>
      )}
    </div>
  )
}
