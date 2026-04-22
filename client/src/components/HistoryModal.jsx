import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { api } from '../utils/api'
import { Button } from '../components/ui'

export default function HistoryModal({ presentationId, onRestore, onClose }) {
  const [snapshots, setSnapshots] = useState([])
  const [snapshotName, setSnapshotName] = useState('')

  useEffect(() => {
    api
      .getSnapshots(presentationId)
      .then(setSnapshots)
      .catch(() => {})
  }, [presentationId])

  const handleSave = async () => {
    await api.saveSnapshot(presentationId, snapshotName || undefined)
    setSnapshotName('')
    setSnapshots(await api.getSnapshots(presentationId))
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-xl p-6 w-[480px] max-w-[90vw] max-h-[70vh] shadow-2xl flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 text-base text-text-primary">Version History</h3>
          <Button variant="ghost" onClick={onClose} className="p-1">
            <X size={16} />
          </Button>
        </div>

        <div className="flex gap-2 mb-4 shrink-0">
          <input
            className="flex-1 px-3 py-2 rounded-md border border-border bg-secondary text-text text-[13px] box-border focus:border-accent focus:outline-none transition-colors"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Snapshot name (optional)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
            }}
          />
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 border-t border-border pt-2 -mx-2 px-2">
          {snapshots.length === 0 ? (
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
                  onClick={async () => {
                    if (!confirm('Restore this snapshot? Current changes will be overwritten.'))
                      return
                    const restored = await api.restoreSnapshot(presentationId, snap.id)
                    onRestore(restored)
                    onClose()
                  }}
                >
                  Restore
                </Button>
                <Button
                  variant="icon"
                  className="text-text-muted hover:text-danger hover:bg-danger/10"
                  title="Delete snapshot"
                  onClick={async () => {
                    await api.deleteSnapshot(presentationId, snap.id)
                    setSnapshots(await api.getSnapshots(presentationId))
                  }}
                >
                  <X size={14} />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
