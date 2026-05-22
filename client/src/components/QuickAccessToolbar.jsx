// QuickAccessToolbar.jsx — fixed 32px quick actions before the ribbon header
// Props: { onSave, onUndo, onRedo, saving, hasChanges, saveStatus, saveError }
import { useCallback } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Redo2, Save, Undo2 } from 'lucide-react'

export default function QuickAccessToolbar({
  onSave,
  onUndo,
  onRedo,
  saving,
  hasChanges,
  saveStatus,
  saveError,
}) {
  const handleUndo = useCallback(() => {
    onUndo?.()
  }, [onUndo])

  const handleRedo = useCallback(() => {
    onRedo?.()
  }, [onRedo])

  const statusTitle = saveStatus === 'error'
    ? `Save failed: ${saveError || 'Unknown error'}`
    : saveStatus === 'saved'
    ? 'Saved'
    : saveStatus === 'saving'
    ? 'Saving...'
    : ''

  return (
    <div
      className="tour-step-quick-access flex items-center gap-1 shrink-0"
      role="toolbar"
      aria-label="Quick actions"
    >
      {/* Save */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={onSave}
        disabled={saving}
        title={statusTitle || (hasChanges ? 'Save (Ctrl+S)' : 'No changes')}
        aria-label={statusTitle || 'Save'}
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Save
            size={18}
            className={hasChanges ? 'text-accent' : 'opacity-50'}
          />
        )}
      </button>

      {saveStatus === 'saved' && (
        <CheckCircle2 size={14} className="text-success" aria-label="Saved" />
      )}
      {saveStatus === 'error' && (
        <div className="flex items-center gap-1 text-[11px] text-danger" role="alert">
          <AlertCircle size={14} />
          <span>Save failed</span>
          <button
            className="rounded px-1.5 py-0.5 text-danger underline-offset-2 hover:bg-danger/10 hover:underline"
            onClick={onSave}
            title={statusTitle}
            aria-label="Retry"
          >
            Retry
          </button>
        </div>
      )}

      <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />

      {/* Undo */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={handleUndo}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <Undo2 size={18} />
      </button>

      {/* Redo */}
      <button
        className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        onClick={handleRedo}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <Redo2 size={18} />
      </button>
    </div>
  )
}
