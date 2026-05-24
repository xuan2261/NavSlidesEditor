import { useState, useEffect } from 'react'
import { CloudUpload, Check, X } from 'lucide-react'
import { api } from '../utils/api'
import { Button, ModalShell } from '../components/ui'

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
      setSyncResult({ type: 'success', scope: 'push', message: `Synced to ${r.destination}` })
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
        scope: 'pull',
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
      setSyncResult({ type: 'success', scope: 'push', message: 'Connected to Proton Drive' })
    } catch (err) {
      setSyncResult({ type: 'error', message: err.message })
    } finally {
      setSyncing(false)
    }
  }

  if (!isOpen) return null

  return (
    <ModalShell titleId="sync-modal-title" title="Sync to Cloud" size="md" onClose={handleClose}>
      <div data-testid="sync-modal-dialog">
        {!syncStatus?.installed ? (
          <div
            className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-[13px] text-danger"
            role="alert"
          >
            rclone is not installed in the container. Rebuild with the updated Dockerfile to enable
            cloud sync.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-xs text-text-muted">{syncStatus.version}</div>

            {syncStatus.remotes?.length > 0 ? (
              <>
                <div
                  data-testid="sync-status-configured"
                  className="px-3.5 py-2.5 bg-[#22c55e]/10 rounded-lg border border-[#22c55e]/20 text-xs text-[#22c55e]"
                >
                  Configured remote{syncStatus.remotes.length > 1 ? 's' : ''}:{' '}
                  {syncStatus.remotes.join(', ')}
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Remote Path</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-text-primary text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 transition-colors box-border"
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
                    data-testid="sync-push-btn"
                    className="flex-1 justify-center flex items-center gap-1.5"
                    disabled={syncing || !presentationId}
                    onClick={handleSyncThis}
                  >
                    <CloudUpload size={14} /> {syncing ? 'Syncing...' : 'Sync This Presentation'}
                  </Button>
                  <Button
                    variant="secondary"
                    data-testid="sync-pull-btn"
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
                <p data-testid="sync-provider-proton-drive" className="text-[13px] text-text-muted">
                  Configure Proton Drive credentials. Your password is stored in the rclone config
                  file on the server.
                </p>
                <div>
                  <label className="text-xs text-text-muted block mb-1">Proton Username</label>
                  <input
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-text-primary text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 transition-colors box-border"
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
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-text-primary text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 transition-colors box-border"
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
                    className="w-full px-3 py-2 rounded-md border border-border bg-card text-text-primary text-sm focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 transition-colors box-border"
                    value={syncConfig.remoteName}
                    onChange={(e) =>
                      setSyncConfig((prev) => ({ ...prev, remoteName: e.target.value }))
                    }
                    placeholder="protondrive"
                  />
                </div>
                <Button
                  variant="primary"
                  data-testid="sync-configure-confirm"
                  className="w-full justify-center"
                  disabled={syncing || !syncConfig.username || !syncConfig.password}
                  onClick={handleConnect}
                >
                  {syncing ? 'Connecting...' : 'Connect'}
                </Button>
              </>
            )}

            {syncResult?.type === 'error' && (
              <div
                data-testid="sync-error-toast"
                className="px-3 py-2 rounded-md text-[13px] flex items-center gap-2 bg-danger/15 text-danger"
                role="alert"
                aria-live="assertive"
              >
                <X size={14} />
                <span>{syncResult.message}</span>
              </div>
            )}
            {syncResult?.type === 'success' && syncResult.scope === 'pull' && (
              <div
                data-testid="sync-pull-result"
                className="px-3 py-2 rounded-md text-[13px] flex items-center gap-2 bg-[#22c55e]/15 text-[#22c55e]"
                role="status"
                aria-live="polite"
              >
                <Check size={14} />
                <span>{syncResult.message}</span>
              </div>
            )}
            {syncResult?.type === 'success' && syncResult.scope !== 'pull' && (
              <div
                data-testid="sync-push-result"
                className="px-3 py-2 rounded-md text-[13px] flex items-center gap-2 bg-[#22c55e]/15 text-[#22c55e]"
                role="status"
                aria-live="polite"
              >
                <Check size={14} />
                <span>{syncResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
