import { useState, useEffect } from 'react'
import { CloudUpload, Check, X } from 'lucide-react'
import { api } from '../utils/api'

export default function SyncModal({ presentationId, onClose }) {
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncConfig, setSyncConfig] = useState({ username: '', password: '', remoteName: 'protondrive' })
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    api.getRcloneStatus().then(setSyncStatus).catch(() => {})
  }, [])

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #3a3a4e', background: '#2a2a3e',
    color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }

  const handleSyncThis = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await api.syncSingleToRemote({
        remote: syncStatus.remotes[0],
        remotePath: syncConfig.remotePath || '/slides-backup',
        presentationId,
      })
      setSyncResult({ type: 'success', message: `Synced to ${r.destination}` })
    } catch (err) {
      setSyncResult({ type: 'error', message: err.message })
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await api.syncToRemote({
        remote: syncStatus.remotes[0],
        remotePath: syncConfig.remotePath || '/slides-backup',
      })
      setSyncResult({ type: 'success', message: `Synced ${r.synced} presentations to ${r.destination}` })
    } catch (err) {
      setSyncResult({ type: 'error', message: err.message })
    } finally {
      setSyncing(false)
    }
  }

  const handleConnect = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      await api.configureRclone(syncConfig)
      const s = await api.getRcloneStatus()
      setSyncStatus(s)
      setSyncResult({ type: 'success', message: 'Connected to Proton Drive' })
    } catch (err) {
      setSyncResult({ type: 'error', message: err.message })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Sync to Cloud</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={16} /></button>
        </div>

        {!syncStatus?.installed ? (
          <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#ef4444' }}>
            rclone is not installed in the container. Rebuild with the updated Dockerfile to enable cloud sync.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#a0a0b0' }}>{syncStatus.version}</div>

            {syncStatus.remotes?.length > 0 ? (
              <>
                <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, color: '#22c55e' }}>
                  Configured remote{syncStatus.remotes.length > 1 ? 's' : ''}: {syncStatus.remotes.join(', ')}
                </div>
                <div>
                  <label style={labelStyle}>Remote Path</label>
                  <input style={inputStyle} value={syncConfig.remotePath || '/slides-backup'} onChange={(e) => setSyncConfig((prev) => ({ ...prev, remotePath: e.target.value }))} placeholder="/slides-backup" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={syncing} onClick={handleSyncThis}>
                    <CloudUpload size={14} /> {syncing ? 'Syncing...' : 'Sync This Presentation'}
                  </button>
                  <button className="btn btn-secondary" style={{ justifyContent: 'center' }} disabled={syncing} onClick={handleSyncAll}>
                    Sync All
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#a0a0b0' }}>
                  Configure Proton Drive credentials. Your password is stored in the rclone config file on the server.
                </p>
                <div>
                  <label style={labelStyle}>Proton Username</label>
                  <input style={inputStyle} value={syncConfig.username} onChange={(e) => setSyncConfig((prev) => ({ ...prev, username: e.target.value }))} placeholder="user@proton.me" />
                </div>
                <div>
                  <label style={labelStyle}>Proton Password</label>
                  <input type="password" style={inputStyle} value={syncConfig.password} onChange={(e) => setSyncConfig((prev) => ({ ...prev, password: e.target.value }))} placeholder="Password" />
                </div>
                <div>
                  <label style={labelStyle}>Remote Name</label>
                  <input style={inputStyle} value={syncConfig.remoteName} onChange={(e) => setSyncConfig((prev) => ({ ...prev, remoteName: e.target.value }))} placeholder="protondrive" />
                </div>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={syncing || !syncConfig.username || !syncConfig.password} onClick={handleConnect}>
                  {syncing ? 'Connecting...' : 'Connect'}
                </button>
              </>
            )}

            {syncResult && (
              <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, background: syncResult.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: syncResult.type === 'success' ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                {syncResult.type === 'success' ? <Check size={14} /> : <X size={14} />}
                <span>{syncResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
