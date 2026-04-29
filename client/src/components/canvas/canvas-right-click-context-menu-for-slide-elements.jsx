import { Button } from '../ui'

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
  ul: '↖', uc: '↑', ur: '↗',
  ml: '←', mc: '⊕', mr: '→',
  ll: '↙', lc: '↓', lr: '↘',
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
 *   onDeleteElement — (id) => void
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
  onDeleteElement,
  onUpdateElement,
  onStartCrop,
  onClose,
}) {
  if (!contextMenu) return null

  const ctxEl = slide?.elements?.find((e) => e.id === contextMenu.elementId)
  const currentRef = ctxEl?.snapRef || 'ul'

  return (
    <div
      className="fixed z-[9999] bg-card border border-border shadow-md rounded-md p-1 min-w-[160px] flex flex-col gap-1"
      style={{ top: contextMenu.y, left: contextMenu.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="ghost"
        disabled={!!ctxEl?.locked}
        onClick={() => { onCopy?.(); onClose() }}
      >
        📋 Copy (Ctrl+C)
      </Button>
      <Button
        variant="ghost"
        onClick={() => { onCut?.(); onDeleteElement(contextMenu.elementId); onClose() }}
      >
        ✂ Cut (Ctrl+X)
      </Button>
      <Button
        variant="ghost"
        onClick={() => { onPaste?.(); onClose() }}
      >
        📌 Paste (Ctrl+V)
      </Button>
      <Button
        variant="ghost"
        disabled={!!ctxEl?.locked}
        onClick={() => { onDuplicate?.(); onClose() }}
      >
        ⧉ Duplicate (Ctrl+D)
      </Button>
      <div className="h-px bg-border my-1" />

      {contextMenu.elementType === 'image' && (
        <>
          <Button variant="ghost" onClick={() => { onStartCrop?.(contextMenu.elementId); onClose() }}>
            ✂ Crop
          </Button>
          <Button
            variant="ghost"
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
            ↺ Reset crop
          </Button>
          <div className="h-px bg-border my-1" />
        </>
      )}

      <div style={snapReferenceLabelStyle}>Snap Reference</div>
      <div style={snapReferenceGridStyle}>
        {SNAP_REF_OPTIONS.map((opt) => (
          <Button
            variant="ghost"
            key={opt.id}
            title={opt.label}
            style={getSnapReferenceButtonStyle(currentRef === opt.id)}
            onClick={() => {
              onUpdateElement(contextMenu.elementId, { snapRef: opt.id })
              onClose()
            }}
          >
            {SNAP_ICONS[opt.id]}
          </Button>
        ))}
      </div>
    </div>
  )
}
