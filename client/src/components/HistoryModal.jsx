import { useState, useEffect, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { api } from '../utils/api'
import { Button } from '../components/ui'
import { isBackdropClick, useEscapeClose } from '../lib/utils'

export default function HistoryModal({ presentationId, onRestore, onClose }) {
  const [snapshots, setSnapshots] = useState([])
  const [snapshotName, setSnapshotName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState('')

  const loadSnapshots = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const nextSnapshots = await api.getSnapshots(presentationId)
      setSnapshots(nextSnapshots)
    } catch (err) {
      setSnapshots([])
      setError(err.message || 'Failed to load version history.')
    } finally {
      setLoading(false)
    }
  }, [presentationId])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  useEscapeClose(onClose)

  const handleSave = async () => {
    setPendingAction('save')
    setError('')
    try {
      await api.saveSnapshot(presentationId, snapshotName || undefined)
      setSnapshotName('')
      await loadSnapshots()
    } catch (err) {
      setError(err.message || 'Failed to save snapshot.')
    } finally {
      setPendingAction('')
    }
  }

  const handleRestore = async (snapshotId) => {
    if (!confirm('Restore this snapshot? Current changes will be overwritten.')) return

    setPendingAction(`restore:${snapshotId}`)
    setError('')
    try {
      const restored = await api.restoreSnapshot(presentationId, snapshotId)
      onRestore(restored)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to restore snapshot.')
    } finally {
      setPendingAction('')
    }
  }

  const handleDelete = async (snapshotId) => {
    setPendingAction(`delete:${snapshotId}`)
    setError('')
    try {
      await api.deleteSnapshot(presentationId, snapshotId)
      await loadSnapshots()
    } catch (err) {
      setError(err.message || 'Failed to delete snapshot.')
    } finally {
      setPendingAction('')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={(event) => {
        if (isBackdropClick(event)) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div
        className="bg-card border border-border rounded-xl p-6 w-[480px] max-w-[90vw] max-h-[70vh] shadow-2xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="history-modal-title" className="m-0 text-base text-text-primary">Version History</h3>
          <Button variant="ghost" onClick={onClose} className="p-1" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <div className="flex gap-2 mb-4 shrink-0">
          <input
            className="flex-1 px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-[13px] box-border focus:border-accent focus:outline-none transition-colors"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Snapshot name (optional)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pendingAction !== 'save') handleSave()
            }}
            disabled={loading || pendingAction === 'save'}
          />
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={loading || pendingAction !== ''}
            className="min-w-[88px] justify-center"
          >
            {pendingAction === 'save' ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </Button>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            <div>{error}</div>
            <div className="mt-2">
              <Button variant="secondary" onClick={loadSnapshots} disabled={loading || pendingAction !== ''}>
                Retry
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 border-t border-border pt-2 -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-5 text-[13px] text-text-muted">
              <Loader2 size={14} className="animate-spin" />
              <span>Loading snapshots...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-text-muted text-[13px] text-center py-5">No snapshots yet</p>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className="flex items-center gap-2.5 py-2 border-b border-border last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text-primary font-medium truncate">
                    {snap.name}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {new Date(snap.createdAt).toLocaleString()} &middot; {snap.slideCount} slide
                    {snap.slideCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="text-[11px] px-2.5 py-1"
                  onClick={() => handleRestore(snap.id)}
                  disabled={pendingAction !== ''}
                >
                  {pendingAction === `restore:${snap.id}` ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    'Restore'
                  )}
                </Button>
                <Button
                  variant="icon"
                  className="text-text-muted hover:text-danger hover:bg-danger/10"
                  title="Delete snapshot"
                  onClick={() => handleDelete(snap.id)}
                  disabled={pendingAction !== ''}
                >
                  {pendingAction === `delete:${snap.id}` ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <X size={14} />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
