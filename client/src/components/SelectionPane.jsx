import { useState, useRef } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Type,
  Image as ImageIcon,
  Square,
  Code,
  BarChart3,
  Table,
  Film,
  Music,
  Hash,
  Layers,
  FileText,
  Sigma,
} from 'lucide-react'

const TYPE_ICONS = {
  text: Type,
  image: ImageIcon,
  shape: Square,
  code: Code,
  chart: BarChart3,
  table: Table,
  video: Film,
  audio: Music,
  icon: Hash,
  group: Layers,
  markdown: FileText,
  latex: Sigma,
}

/** Get icon component for element type */
function ElIcon({ type, size = 13 }) {
  const Icon = TYPE_ICONS[type] || Square
  return <Icon size={size} className="shrink-0 opacity-60" />
}

/**
 * SelectionPane — PowerPoint-style layer list.
 *
 * Props:
 *   elements    — slide.elements[]
 *   selectedIds — string[] of selected element ids
 *   onSelect    — (id, additive: boolean) => void
 *   onToggleVisibility — (id) => void
 *   onToggleLock       — (id) => void
 *   onRename           — (id, name: string) => void
 *   onReorder          — (fromIdx, toIdx) => void
 */
export default function SelectionPane({
  elements = [],
  selectedIds = [],
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRename,
  onReorder,
}) {
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const dragItem = useRef(null)
  const dragOverIdx = useRef(null)

  const handleDoubleClick = (el) => {
    setRenamingId(el.id)
    setRenameValue(el.name || el.type || 'Element')
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleItemKeyDown = (e, el, idx) => {
    if (e.target !== e.currentTarget) return

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleItemClick(e, el)
      return
    }
    if (e.key === 'F2') {
      e.preventDefault()
      handleDoubleClick(el)
      return
    }
    if (e.key === 'Escape' && renamingId === el.id) {
      e.preventDefault()
      cancelRename()
      return
    }
    if (
      e.altKey &&
      !el.locked &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      const toIdx = idx + (e.key === 'ArrowUp' ? -1 : 1)
      if (toIdx >= 0 && toIdx < elements.length) {
        e.preventDefault()
        onReorder?.(idx, toIdx)
      }
    }
  }

  const handleDragStart = (e, idx) => {
    if (elements[idx]?.locked) {
      e.preventDefault()
      return
    }
    dragItem.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverIdx.current = idx
    // Visual hint — let parent handle actual reorder on drop
  }

  const handleDrop = (e, toIdx) => {
    e.preventDefault()
    if (dragItem.current != null && dragItem.current !== toIdx) {
      onReorder(dragItem.current, toIdx)
    }
    dragItem.current = null
    dragOverIdx.current = null
  }

  const handleDragEnd = () => {
    dragItem.current = null
    dragOverIdx.current = null
  }

  const handleItemClick = (e, el) => {
    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    if (onSelect) onSelect(el.id, additive)
  }

  return (
    <div className="selection-pane select-none" role="list" aria-label="Slide layers">
      {elements.length === 0 && (
        <div className="px-1.5 py-2 text-[11px] italic text-text-muted">
          No elements on this slide
        </div>
      )}
      {elements.map((el, idx) => {
        const isSelected = selectedIds.includes(el.id)
        const isRenaming = renamingId === el.id
        const isHidden = el.hidden || false
        const isLocked = el.locked || false
        const label = el.name || el.type || 'Element'
        const typeLabel = el.type ? el.type.charAt(0).toUpperCase() + el.type.slice(1) : '?'

        return (
          <div
            key={el.id}
            role="listitem"
            tabIndex={0}
            aria-label={`${label}, ${typeLabel}${isLocked ? ', locked' : ''}${isHidden ? ', hidden' : ''}`}
            aria-selected={isSelected}
            className={`selection-pane-item flex items-center gap-1 px-1 py-[3px] rounded text-xs cursor-pointer transition-colors ${isSelected ? 'bg-accent/15 border-l-2 border-accent' : 'bg-transparent border-l-2 border-transparent'} ${isHidden ? 'opacity-45' : 'opacity-100'}`}
            draggable={!isLocked}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onClick={(e) => handleItemClick(e, el)}
            onKeyDown={(e) => handleItemKeyDown(e, el, idx)}
            onDoubleClick={() => handleDoubleClick(el)}
            title={`${label} — ${typeLabel}${isLocked ? ' (locked)' : ''}${isHidden ? ' (hidden)' : ''}`}
          >
            {/* Drag handle */}
            <GripVertical size={11} className="shrink-0 cursor-grab opacity-35" />

            {/* Type icon */}
            <ElIcon type={el.type} size={12} />

            {/* Name — inline editable */}
            {isRenaming ? (
              <input
                autoFocus
                size={Math.max(6, renameValue.length)}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') cancelRename()
                  e.stopPropagation()
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Rename ${label}`}
                className="min-w-0 flex-1 rounded-sm border border-accent bg-input px-[3px] text-xs text-text-primary"
              />
            ) : (
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-text-secondary">
                {label}
              </span>
            )}

            {/* Visibility toggle */}
            <button
              data-testid={`selection-pane-toggle-visibility-${el.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleVisibility(el.id)
              }}
              title={isHidden ? 'Show element' : 'Hide element'}
              aria-label={isHidden ? 'Show element' : 'Hide element'}
              className={`flex items-center rounded-sm border-none bg-transparent px-0.5 py-px ${
                isHidden ? 'text-text-muted' : 'text-text-secondary'
              }`}
            >
              {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>

            {/* Lock toggle */}
            <button
              data-testid={`selection-pane-toggle-lock-${el.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleLock(el.id)
              }}
              title={isLocked ? 'Unlock element' : 'Lock element'}
              aria-label={isLocked ? 'Unlock element' : 'Lock element'}
              className={`flex items-center rounded-sm border-none bg-transparent px-0.5 py-px ${
                isLocked ? 'text-accent' : 'text-text-muted'
              }`}
            >
              {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
