import { useEffect, useState } from 'react'
import { X, Copy, Trash2 } from 'lucide-react'
import { Button } from '../components/ui'

function getBgStyle(bg) {
  if (!bg) return { backgroundColor: 'var(--bg-card)' }
  if (bg.type === 'color') return { backgroundColor: bg.color || 'var(--bg-card)' }
  if (bg.type === 'gradient') return { background: bg.gradient || 'var(--bg-card)' }
  if (bg.type === 'image' && bg.image)
    return {
      backgroundImage: `url(${bg.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      opacity: 0.5,
  }
  if (bg.type === 'fx') return { backgroundColor: bg.fx?.fallbackColor || '#0d0221' }
  return { backgroundColor: 'var(--bg-card)' }
}

function getMiniPreviewElementStyle(el) {
  return {
    position: 'absolute',
    left: `${(el.x / 1280) * 100}%`,
    top: `${(el.y / 720) * 100}%`,
    width: `${((el.width ?? 100) / 1280) * 100}%`,
    height: `${((el.height ?? 40) / 720) * 100}%`,
    fontSize: 4,
    overflow: 'hidden',
    color: 'var(--text-primary)',
    pointerEvents: 'none',
    zIndex: el.zIndex ?? 1,
  }
}

function getContextMenuStyle(ctxMenu) {
  return {
    top: ctxMenu.y,
    left: ctxMenu.x,
  }
}

function MiniPreview({ slide, idx }) {
  const els = (slide.elements || []).slice(0, 4)
  return (
    <div
      data-testid={`slide-sorter-preview-${idx}`}
      className="relative aspect-video w-full overflow-hidden rounded-b-md"
      style={getBgStyle(slide.background)}
    >
      {els.map((el, i) => (
        <div key={el.id || i} style={getMiniPreviewElementStyle(el)}>
          {el.type === 'text' && (
            <span>{(el.content || '').replace(/<[^>]+>/g, ' ').slice(0, 20)}</span>
          )}
          {el.type === 'image' && <span className="opacity-40">🖼</span>}
          {el.type === 'html' && <span className="opacity-40">&lt;/&gt;</span>}
          {el.type === 'code' && <span className="opacity-40">⌨</span>}
          {el.type === 'latex' && <span className="opacity-40">∑</span>}
          {!['text', 'image', 'html', 'code', 'latex'].includes(el.type) && (
            <span className="opacity-30">{el.type}</span>
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (ctxMenu) setCtxMenu(null)
        else onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, ctxMenu])

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

  const handleCardClick = (e, idx) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      setSelectedIndices((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
      )
    } else if (e.shiftKey && selectedIndices.length > 0) {
      const last = selectedIndices[selectedIndices.length - 1]
      const start = Math.min(last, idx)
      const end = Math.max(last, idx)
      setSelectedIndices(Array.from({ length: end - start + 1 }, (_, i) => start + i))
    } else {
      setSelectedIndices([idx])
    }
  }

  const handleCardDoubleClick = (idx) => {
    onSelect?.(idx)
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) setCtxMenu(null)
  }

  const handleBulkDelete = () => {
    const sorted = [...selectedIndices].sort((a, b) => b - a)
    sorted.forEach((idx) => onDelete?.(idx))
    setSelectedIndices([])
  }

  const handleBulkDuplicate = () => {
    const sorted = [...selectedIndices].sort((a, b) => a - b)
    sorted.forEach((idx) => onDuplicate?.(idx))
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 flex flex-col"
      onClick={(e) => {
        setCtxMenu(null)
        handleOverlayClick(e)
      }}
    >
      <div className="flex items-center justify-between px-6 py-4 bg-card border-b border-border shrink-0">
        <span>Slide Sorter</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted">
            Click: select &nbsp;|&nbsp; Double-click: open &nbsp;|&nbsp; Ctrl+Click: multi-select &nbsp;|&nbsp; Drag: reorder &nbsp;|&nbsp; Esc: close
          </span>
          <Button variant="icon" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </Button>
        </div>
      </div>

      {selectedIndices.length >= 2 && (
        <div
          data-testid="slide-sorter-bulk-toolbar"
          className="flex items-center gap-2 px-6 py-2 bg-secondary border-b border-border shrink-0"
        >
          <span className="text-[12px] text-text-primary font-medium">
            {selectedIndices.length} selected
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="secondary"
              className="text-[11px] px-2.5 py-1"
              data-testid="slide-sorter-bulk-duplicate"
              onClick={handleBulkDuplicate}
            >
              <Copy size={12} /> Duplicate
            </Button>
            <Button
              variant="secondary"
              className="text-[11px] px-2.5 py-1 text-danger"
              data-testid="slide-sorter-bulk-delete"
              onClick={handleBulkDelete}
              disabled={slides.length - selectedIndices.length < 1}
            >
              <Trash2 size={12} /> Delete
            </Button>
            <Button
              variant="ghost"
              className="text-[11px] px-2.5 py-1"
              onClick={() => setSelectedIndices([currentIndex])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {slides.map((slide, idx) => {
          const isCurrent = idx === currentIndex
          const isDragging = dragIdx === idx
          const isOver = dragOverIdx === idx && dragIdx !== idx
          const isMultiSelected = selectedIndices.includes(idx) && idx !== currentIndex

          return (
            <div
              key={slide.id || idx}
              className={`group relative rounded-lg border-2 cursor-pointer transition-all ${isCurrent ? 'border-accent shadow-lg shadow-accent/20' : 'border-border hover:border-border-strong'} ${isDragging ? 'opacity-50 scale-95' : ''} ${isOver ? 'border-accent border-dashed' : ''} ${isMultiSelected ? 'ring-2 ring-accent/50' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={(e) => handleCardClick(e, idx)}
              onDoubleClick={() => handleCardDoubleClick(idx)}
              onContextMenu={(e) => handleContextMenu(e, idx)}
              title={`Slide ${idx + 1}`}
            >
              <div
                data-testid={`slide-sorter-number-${idx + 1}`}
                className="text-center py-1.5 text-xs font-medium text-text-secondary bg-card rounded-t-md"
              >
                {idx + 1}
              </div>
              <MiniPreview slide={slide} idx={idx} />
            </div>
          )
        })}
      </div>

      {ctxMenu && (
        <div
          className="absolute z-[100] bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={getContextMenuStyle(ctxMenu)}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-text-primary hover:bg-hover transition-colors cursor-pointer bg-transparent border-none text-left"
            onClick={() => {
              onDuplicate(ctxMenu.slideIdx)
              setCtxMenu(null)
            }}
          >
            <Copy size={12} /> Duplicate
          </button>
          <button
            className={`flex items-center gap-2 w-full px-3 py-2 text-[13px] hover:bg-hover transition-colors cursor-pointer bg-transparent border-none text-left ${slides.length > 1 ? 'text-danger' : 'text-text-primary'}`}
            onClick={() => {
              if (slides.length > 1) onDelete(ctxMenu.slideIdx)
              setCtxMenu(null)
            }}
            disabled={slides.length <= 1}
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
