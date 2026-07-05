import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Clipboard,
  Copy,
  CopyPlus,
  Crop,
  Crosshair,
  Scissors,
  Undo2,
} from 'lucide-react'
import { Button } from '../ui'
import { sanitizeMediaSrc } from '../../utils/url-safety'

const SNAP_REF_OPTIONS = [
  { id: 'ul', label: 'Upper Left', fx: 0, fy: 0 },
  { id: 'uc', label: 'Upper Center', fx: 0.5, fy: 0 },
  { id: 'ur', label: 'Upper Right', fx: 1, fy: 0 },
  { id: 'ml', label: 'Middle Left', fx: 0, fy: 0.5 },
  { id: 'mc', label: 'Center', fx: 0.5, fy: 0.5 },
  { id: 'mr', label: 'Middle Right', fx: 1, fy: 0.5 },
  { id: 'll', label: 'Lower Left', fx: 0, fy: 1 },
  { id: 'lc', label: 'Lower Center', fx: 0.5, fy: 1 },
  { id: 'lr', label: 'Lower Right', fx: 1, fy: 1 },
]

const snapReferenceLabelStyle = {
  padding: '4px 8px 2px',
  fontSize: 10,
  color: 'var(--text-muted)',
  userSelect: 'none',
}

const snapReferenceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3,1fr)',
  gap: 2,
  padding: '2px 6px 6px',
}

function getSnapReferenceButtonStyle(isActive) {
  return {
    padding: '5px 4px',
    fontSize: 11,
    background: isActive ? 'var(--accent)' : 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

const SNAP_ICONS = {
  ul: ArrowUpLeft,
  uc: ArrowUp,
  ur: ArrowUpRight,
  ml: ArrowLeft,
  mc: Crosshair,
  mr: ArrowRight,
  ll: ArrowDownLeft,
  lc: ArrowDown,
  lr: ArrowDownRight,
}

export function getCopyableMediaUrl(element, origin = globalThis.location?.origin) {
  const raw = typeof element?.src === 'string' ? element.src.trim() : ''
  if (!raw) return null
  if (/^blob:/i.test(raw)) return raw

  const safe = sanitizeMediaSrc(raw)
  if (!safe) return null
  if (/^(https?:|data:)/i.test(safe)) return safe
  if (!origin) return null

  try {
    const url = new URL(safe, origin)
    return /^https?:$/i.test(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * CanvasContextMenu — right-click context menu for slide elements.
 * Props:
 *   contextMenu  — { elementId, elementType, x, y } | null
 *   slide        — current slide object (for looking up element)
 *   onCopy       — () => void
 *   onCut        — () => void
 *   onPaste      — () => void
 *   onDuplicate  — () => void
 *   onUpdateElement — (id, changes) => void
 *   onStartCrop  — (elementId) => void
 *   onClose      — () => void
 */
export default function CanvasContextMenu({
  contextMenu,
  slide,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onUpdateElement,
  onStartCrop,
  onClose,
  clipboard = globalThis.navigator?.clipboard,
  origin = globalThis.location?.origin,
}) {
  if (!contextMenu) return null

  const ctxEl = slide?.elements?.find((e) => e.id === contextMenu.elementId)
  const contextSelectionIds = contextMenu.contextSelectionIds || [contextMenu.elementId]
  const contextElements = (slide?.elements || []).filter((e) => contextSelectionIds.includes(e.id))
  const hasLockedContext = contextElements.some((e) => e.locked)
  const isReadOnly = !!slide?.locked || hasLockedContext
  const currentRef = ctxEl?.snapRef || 'ul'
  const copyableUrl = ['image', 'video'].includes(contextMenu.elementType)
    ? getCopyableMediaUrl(ctxEl, origin)
    : null
  const copyUrl = () => {
    if (copyableUrl && clipboard?.writeText) {
      try {
        Promise.resolve(clipboard.writeText(copyableUrl)).catch(() => {})
      } catch {
        // Clipboard failures should not keep the context menu open or break editing.
      }
    }
    onClose()
  }

  return (
    <div
      className="fixed z-[9999] bg-card border border-border shadow-md rounded-md p-1 min-w-[160px] flex flex-col gap-1"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        disabled={isReadOnly}
        onClick={() => {
          onCopy?.()
          onClose()
        }}
      >
        <Copy size={14} /> Copy (Ctrl+C)
      </Button>
      <Button
        variant="ghost"
        disabled={isReadOnly}
        onClick={() => {
          onCut?.()
          onClose()
        }}
      >
        <Scissors size={14} /> Cut (Ctrl+X)
      </Button>
      <Button
        variant="ghost"
        disabled={!!slide?.locked}
        onClick={() => {
          if (slide?.locked) return
          onPaste?.()
          onClose()
        }}
      >
        <Clipboard size={14} /> Paste (Ctrl+V)
      </Button>
      <Button
        variant="ghost"
        disabled={isReadOnly}
        onClick={() => {
          onDuplicate?.()
          onClose()
        }}
      >
        <CopyPlus size={14} /> Duplicate (Ctrl+D)
      </Button>
      <div className="h-px bg-border my-1" />

      {contextMenu.elementType === 'image' && (
        <>
          <Button
            variant="ghost"
            disabled={isReadOnly}
            onClick={() => {
              onStartCrop?.(contextMenu.elementId)
              onClose()
            }}
          >
            <Crop size={14} /> Crop
          </Button>
          <Button
            variant="ghost"
            disabled={isReadOnly}
            onClick={() => {
              const el = slide?.elements?.find((e) => e.id === contextMenu.elementId)
              if (el && el.imageW != null) {
                onUpdateElement(contextMenu.elementId, {
                  x: el.x + (el.imageOffsetX ?? 0),
                  y: el.y + (el.imageOffsetY ?? 0),
                  width: el.imageW,
                  height: el.imageH,
                  imageW: null,
                  imageH: null,
                  imageOffsetX: null,
                  imageOffsetY: null,
                  crop: null,
                })
              }
              onClose()
            }}
          >
            <Undo2 size={14} /> Reset crop
          </Button>
          {copyableUrl && (
            <Button variant="ghost" onClick={copyUrl}>
              <Clipboard size={14} /> Copy URL
            </Button>
          )}
          <div className="h-px bg-border my-1" />
        </>
      )}

      {contextMenu.elementType === 'video' && copyableUrl && (
        <>
          <Button variant="ghost" onClick={copyUrl}>
            <Clipboard size={14} /> Copy URL
          </Button>
          <div className="h-px bg-border my-1" />
        </>
      )}

      <div style={snapReferenceLabelStyle}>Snap Reference</div>
      <div style={snapReferenceGridStyle}>
        {SNAP_REF_OPTIONS.map((opt) => {
          const Icon = SNAP_ICONS[opt.id]
          return (
            <Button
              variant="ghost"
              key={opt.id}
              title={opt.label}
              aria-label={opt.label}
              disabled={isReadOnly}
              style={getSnapReferenceButtonStyle(currentRef === opt.id)}
              onClick={() => {
                if (isReadOnly) return
                onUpdateElement(contextMenu.elementId, { snapRef: opt.id })
                onClose()
              }}
            >
              <Icon size={14} aria-hidden="true" />
            </Button>
          )
        })}
      </div>
    </div>
  )
}
