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
    <div className="quick-access-toolbar">
      {/* Save */}
      <button
        className="qat-btn"
        onClick={onSave}
        disabled={saving}
        title={saving ? 'Saving…' : hasChanges ? 'Save (Ctrl+S)' : 'No changes'}
      >
        {saving ? (
          <Loader2 size={13} className="spin" />
        ) : (
          <span className="qat-dot" style={{ opacity: hasChanges ? 1 : 0.3 }} />
        )}
      </button>

      <span className="qat-divider" />

      {/* Undo */}
      <button className="qat-btn" onClick={handleUndo} title="Undo (Ctrl+Z)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
        </svg>
      </button>

      {/* Redo */}
      <button className="qat-btn" onClick={handleRedo} title="Redo (Ctrl+Y)" style={{ transform: 'scaleX(-1)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 13" />
        </svg>
      </button>

      <span className="qat-divider" />

      {/* Present */}
      <button className="qat-btn qat-present-btn" onClick={onPresent} title="Present">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21" />
        </svg>
      </button>
    </div>
  )
}
