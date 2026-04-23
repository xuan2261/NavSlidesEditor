import { useState, useEffect } from 'react'
import { Github, Settings, Check, X } from 'lucide-react'
import { api } from '../utils/api'
import { Button } from '../components/ui'
import { isBackdropClick, useEscapeClose } from '../lib/utils'

export default function GitHubPushModal({ presentationId, presentationTitle, onClose }) {
  const [config, setConfig] = useState({ owner: '', repo: '', hasToken: false })
  const [token, setToken] = useState('')
  const [pushing, setPushing] = useState(false)
  const [status, setStatus] = useState(null)
  const [commitMsg, setCommitMsg] = useState('')

  useEffect(() => {
    api
      .getGithubConfig()
      .then(setConfig)
      .catch(() => {})
  }, [])

  const handleSaveConfig = async () => {
    const data = { owner: config.owner, repo: config.repo }
    if (token) data.token = token
    const result = await api.saveGithubConfig(data)
    setConfig(result)
    setToken('')
  }

  const handlePush = async () => {
    setPushing(true)
    setStatus(null)
    try {
      const result = await api.pushToGithub(presentationId, commitMsg.trim() || undefined)
      setStatus({ type: 'success', message: 'Pushed to GitHub', url: result.url })
      setCommitMsg('')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setPushing(false)
    }
  }

  useEscapeClose(onClose)

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50"
      onClick={(event) => {
        if (isBackdropClick(event)) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-push-modal-title"
    >
      <div
        className="bg-card rounded-xl p-6 w-[420px] max-w-[90vw] shadow-2xl border border-border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="github-push-modal-title" className="m-0 text-base text-text-primary">Save to GitHub</h3>
          <Button variant="ghost" onClick={onClose} className="p-1" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Repository Owner</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm box-border focus:border-accent focus:outline-none transition-colors"
              value={config.owner}
              onChange={(e) => setConfig((prev) => ({ ...prev, owner: e.target.value }))}
              placeholder="username or org"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Repository Name</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm box-border focus:border-accent focus:outline-none transition-colors"
              value={config.repo}
              onChange={(e) => setConfig((prev) => ({ ...prev, repo: e.target.value }))}
              placeholder="my-presentations"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">
              Personal Access Token{' '}
              {config.hasToken && <span className="text-[#22c55e]">(saved)</span>}
            </label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm box-border focus:border-accent focus:outline-none transition-colors"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={config.hasToken ? '••••••••  (leave blank to keep)' : 'ghp_...'}
            />
          </div>
          <Button
            variant="secondary"
            onClick={handleSaveConfig}
            className="self-start flex items-center gap-1.5"
          >
            <Settings size={14} /> Save Settings
          </Button>

          <hr className="border-none border-t border-border my-1" />

          <div>
            <label className="text-xs text-text-muted block mb-1">Commit Message (optional)</label>
            <input
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm box-border focus:border-accent focus:outline-none transition-colors"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder={`${presentationTitle || 'Untitled'} ${new Date().toLocaleString()}`}
            />
          </div>

          <Button
            variant="primary"
            onClick={handlePush}
            disabled={pushing || !config.hasToken || !config.owner || !config.repo}
            className={`w-full justify-center ${pushing || !config.hasToken || !config.owner || !config.repo ? 'opacity-50' : 'opacity-100'} flex items-center gap-1.5`}
          >
            <Github size={14} /> {pushing ? 'Pushing...' : 'Push to GitHub'}
          </Button>

          {status && (
            <div
              className={`px-3 py-2 rounded-md text-[13px] flex items-center gap-2 ${status.type === 'success' ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-danger/15 text-danger'}`}
            >
              {status.type === 'success' ? <Check size={14} /> : <X size={14} />}
              <span>{status.message}</span>
              {status.url && (
                <a
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-inherit underline"
                >
                  View
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
