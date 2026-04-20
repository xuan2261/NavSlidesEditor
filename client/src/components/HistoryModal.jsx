import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { api } from '../utils/api'

export default function HistoryModal({ presentationId, onRestore, onClose }) {
  const [snapshots, setSnapshots] = useState([])
  const [snapshotName, setSnapshotName] = useState('')

  useEffect(() => {
    api.getSnapshots(presentationId).then(setSnapshots).catch(() => {})
  }, [presentationId])

  const handleSave = async () => {
    await api.saveSnapshot(presentationId, snapshotName || undefined)
    setSnapshotName('')
    setSnapshots(await api.getSnapshots(presentationId))
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw', maxHeight: '70vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Version History</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #3a3a4e', background: '#2a2a3e', color: '#e0e0e0', fontSize: 13, boxSizing: 'border-box' }}
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Snapshot name (optional)"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {snapshots.length === 0 ? (
            <p style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 20 }}>No snapshots yet</p>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderBottom: '1px solid #2a2a3e' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{snap.name}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {new Date(snap.createdAt).toLocaleString()} &middot; {snap.slideCount} slide{snap.slideCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={async () => {
                    if (!confirm('Restore this snapshot? Current changes will be overwritten.')) return
                    const restored = await api.restoreSnapshot(presentationId, snap.id)
                    onRestore(restored)
                    onClose()
                  }}
                >
                  Restore
                </button>
                <button
                  className="btn-icon"
                  style={{ color: 'var(--danger)' }}
                  title="Delete snapshot"
                  onClick={async () => {
                    await api.deleteSnapshot(presentationId, snap.id)
                    setSnapshots(await api.getSnapshots(presentationId))
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
