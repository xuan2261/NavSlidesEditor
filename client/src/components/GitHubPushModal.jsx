import { useState, useEffect } from 'react'
import { Github, Settings, Check, X } from 'lucide-react'
import { api } from '../utils/api'

export default function GitHubPushModal({ presentationId, presentationTitle, onClose }) {
  const [config, setConfig] = useState({ owner: '', repo: '', hasToken: false })
  const [token, setToken] = useState('')
  const [pushing, setPushing] = useState(false)
  const [status, setStatus] = useState(null)
  const [commitMsg, setCommitMsg] = useState('')

  useEffect(() => {
    api.getGithubConfig().then(setConfig).catch(() => {})
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

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 6,
    border: '1px solid #3a3a4e', background: '#2a2a3e',
    color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#1e1e2e', borderRadius: 12, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#e0e0e0' }}>Save to GitHub</h3>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Repository Owner</label>
            <input style={inputStyle} value={config.owner} onChange={(e) => setConfig((prev) => ({ ...prev, owner: e.target.value }))} placeholder="username or org" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Repository Name</label>
            <input style={inputStyle} value={config.repo} onChange={(e) => setConfig((prev) => ({ ...prev, repo: e.target.value }))} placeholder="my-presentations" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>
              Personal Access Token {config.hasToken && <span style={{ color: '#22c55e' }}>(saved)</span>}
            </label>
            <input type="password" style={inputStyle} value={token} onChange={(e) => setToken(e.target.value)} placeholder={config.hasToken ? '••••••••  (leave blank to keep)' : 'ghp_...'} />
          </div>
          <button className="btn btn-secondary" onClick={handleSaveConfig} style={{ alignSelf: 'flex-start' }}>
            <Settings size={14} /> Save Settings
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid #3a3a4e', margin: '4px 0' }} />

          <div>
            <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Commit Message (optional)</label>
            <input style={inputStyle} value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder={`${presentationTitle || 'Untitled'} ${new Date().toLocaleString()}`} />
          </div>

          <button className="btn btn-primary" onClick={handlePush} disabled={pushing || !config.hasToken || !config.owner || !config.repo} style={{ width: '100%', justifyContent: 'center', opacity: pushing || !config.hasToken || !config.owner || !config.repo ? 0.5 : 1 }}>
            <Github size={14} /> {pushing ? 'Pushing...' : 'Push to GitHub'}
          </button>

          {status && (
            <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 13, background: status.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: status.type === 'success' ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
              {status.type === 'success' ? <Check size={14} /> : <X size={14} />}
              <span>{status.message}</span>
              {status.url && <a href={status.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: 'inherit', textDecoration: 'underline' }}>View</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
