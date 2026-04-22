// QuickAccessToolbar.jsx — fixed 32px toolbar above EditorMenuBar
// Props: { onSave, onUndo, onRedo, onPresent, saving, hasChanges }
import { useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

export default function QuickAccessToolbar({
  onSave,
  // eslint-disable-next-line unused-imports/no-unused-vars
  onUndo,
  // eslint-disable-next-line unused-imports/no-unused-vars
  onRedo,
  onPresent,
  saving,
  hasChanges,
}) {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const undoRef = useRef(null)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const redoRef = useRef(null)

  // Trigger undo via keyboard shortcut trick
  const handleUndo = useCallback(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
  }, [])

  const handleRedo = useCallback(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
  }, [])

  return (
    <div className="flex items-center gap-1">
      {/* Save */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={onSave}
        disabled={saving}
        title={saving ? 'Saving…' : hasChanges ? 'Save (Ctrl+S)' : 'No changes'}
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <span className="qat-dot" style={{ opacity: hasChanges ? 1 : 0.3 }} />
        )}
      </button>

      <span className="mx-1 h-4 w-[1px] bg-border" />

      {/* Undo */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={handleUndo}
        title="Undo (Ctrl+Z)"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
        </svg>
      </button>

      {/* Redo */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={handleRedo}
        title="Redo (Ctrl+Y)"
        style={{ transform: 'scaleX(-1)' }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
        </svg>
      </button>

      <span className="mx-1 h-4 w-[1px] bg-border" />

      {/* Present */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={onPresent}
        title="Present"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </button>
    </div>
  )
}
