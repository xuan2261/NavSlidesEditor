import { useState, useRef } from 'react'
import {
  Eye, EyeOff, Lock, Unlock, GripVertical,
  Type, Image, Square, Code, BarChart2, Table,
  Film, Music, Hash, Layers, FileText, Sigma
} from 'lucide-react'

const TYPE_ICONS = {
  text: Type,
  image: Image,
  shape: Square,
  code: Code,
  chart: BarChart2,
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
  return <Icon size={size} style={{ flexShrink: 0, opacity: 0.6 }} />
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

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleDragStart = (e, idx) => {
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
    <div className="selection-pane" style={{ userSelect: 'none' }}>
      {elements.length === 0 && (
        <div style={{ padding: '8px 6px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
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
            className={`selection-pane-item ${isSelected ? 'selected' : ''} ${isHidden ? 'hidden' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 4px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              opacity: isHidden ? 0.45 : 1,
              background: isSelected ? 'var(--accent-alpha, rgba(99,102,241,0.15))' : 'transparent',
              borderLeft: isSelected ? '2px solid var(--accent, #6366f1)' : '2px solid transparent',
              transition: 'background 0.1s',
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            onClick={(e) => handleItemClick(e, el)}
            onDoubleClick={() => handleDoubleClick(el)}
            title={`${label} — ${typeLabel}${isLocked ? ' (locked)' : ''}${isHidden ? ' (hidden)' : ''}`}
          >
            {/* Drag handle */}
            <GripVertical size={11} style={{ opacity: 0.35, flexShrink: 0, cursor: 'grab' }} />

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
                  if (e.key === 'Escape') { setRenamingId(null) }
                  e.stopPropagation()
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  fontSize: 12,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--accent)',
                  borderRadius: 3,
                  padding: '0 3px',
                  color: 'var(--text-primary)',
                  minWidth: 0,
                }}
              />
            ) : (
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text-secondary)',
                }}
              >
                {label}
              </span>
            )}

            {/* Visibility toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(el.id) }}
              title={isHidden ? 'Show element' : 'Hide element'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '1px 2px',
                color: isHidden ? 'var(--text-muted)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 3,
              }}
            >
              {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>

            {/* Lock toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLock(el.id) }}
              title={isLocked ? 'Unlock element' : 'Lock element'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '1px 2px',
                color: isLocked ? 'var(--accent, #6366f1)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 3,
              }}
            >
              {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
