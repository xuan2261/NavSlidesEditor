import { useState, useEffect } from 'react'
import { CloudUpload, Check, X } from 'lucide-react'
import { api } from '../utils/api'
import { Button } from '../components/ui'
import { isBackdropClick } from '../lib/utils'

export default function SyncModal({ presentationId, onClose }) {
  const [isOpen, setIsOpen] = useState(true)
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncConfig, setSyncConfig] = useState({
    username: '',
    password: '',
    remoteName: 'protondrive',
  })
  const [syncResult, setSyncResult] = useState(null)
  const [syncing, setSyncing] = useState(false)

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api
      .getRcloneStatus()
      .then(setSyncStatus)
      .catch(() => {})
  }, [])

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
      setSyncResult({
        type: 'success',
        message: `Synced ${r.synced} presentations to ${r.destination}`,
      })
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
    >
      <div
        className="bg-card border border-border rounded-xl p-6 w-[440px] max-w-[90vw] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="sync-modal-title" className="m-0 text-base text-text-primary">Sync to Cloud</h3>
          <Button variant="ghost" onClick={handleClose} className="p-1" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        {!syncStatus?.installed ? (
          <div className="p-4 bg-danger/10 rounded-lg border border-danger/20 text-[13px] text-danger">
            rclone is not installed in the container. Rebuild with the updated Dockerfile to enable
            cloud sync.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-text-muted">{syncStatus.version}</div>

            {syncStatus.remotes?.length > 0 ? (
              <>
                <div className="px-3.5 py-2.5 bg-[#22c55e]/10 rounded-lg border border-[#22c55e]/20 text-xs text-[#22c55e]">
                  Configured remote{syncStatus.remotes.length > 1 ? 's' : ''}:{' '}
                  {syncStatus.remotes.join(', ')}
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Remote Path</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors box-border"
                    value={syncConfig.remotePath || '/slides-backup'}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({ ...prev, remotePath: e.target.value }))
                    }
                    placeholder="/slides-backup"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    className="flex-1 justify-center flex items-center gap-1.5"
                    disabled={syncing}
                    onClick={handleSyncThis}
                  >
                    <CloudUpload size={14} /> {syncing ? 'Syncing...' : 'Sync This Presentation'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="justify-center"
                    disabled={syncing}
                    onClick={handleSyncAll}
                  >
                    Sync All
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-text-muted">
                  Configure Proton Drive credentials. Your password is stored in the rclone config
                  file on the server.
                </p>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Proton Username</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors box-border"
                    value={syncConfig.username}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({ ...prev, username: e.target.value }))
                    }
                    placeholder="user@proton.me"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Proton Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors box-border"
                    value={syncConfig.password}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Password"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Remote Name</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors box-border"
                    value={syncConfig.remoteName}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({ ...prev, remoteName: e.target.value }))
                    }
                    placeholder="protondrive"
                  />
                </div>
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  disabled={syncing || !syncConfig.username || !syncConfig.password}
                  onClick={handleConnect}
                >
                  {syncing ? 'Connecting...' : 'Connect'}
                </Button>
              </>
            )}

            {syncResult && (
              <div
                className={`px-3 py-2 rounded-md text-[13px] flex items-center gap-2 ${syncResult.type === 'success' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-danger/15 text-danger'}`}
              >
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
