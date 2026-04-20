import { useState, useEffect } from 'react'
import { Link2, X, Copy, Trash2, Plus, Lock, Clock, Eye, Loader2, Check } from 'lucide-react'

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000,
}
const modal = {
  background: 'var(--bg-card)', borderRadius: 12, padding: 24,
  width: 560, maxHeight: '85vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)',
}
const field = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
}

export default function ShareModal({ presentationId, onClose }) {
  const [shares, setShares] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState('links') // links | embed
  const [copied, setCopied] = useState('')
  
  // New link form
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newExpiry, setNewExpiry] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)

  const loadShares = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presentations/${presentationId}/shares`)
      const data = await res.json()
      setShares(data.shares || [])
    } catch (err) {
      console.error('Failed to load shares', err)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadShares() }, [presentationId])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const body = { name: newName || 'Shared Link' }
      if (newPassword) body.password = newPassword
      if (newExpiry) body.expiresInDays = parseInt(newExpiry)
      
      const res = await fetch(`/api/presentations/${presentationId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create share link')
      
      setNewName(''); setNewPassword(''); setNewExpiry(''); setShowNewForm(false)
      loadShares()
    } catch (err) {
      alert(err.message)
    } finally { setCreating(false) }
  }

  const handleDelete = async (token) => {
    if (!confirm('Delete this share link?')) return
    try {
      const res = await fetch(`/api/shares/${token}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete share link')
      loadShares()
    } catch (err) { alert(err.message) }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const shareUrl = (token) => `${window.location.origin}/share/${token}`
  const embedCode = (token) =>
    `<iframe src="${shareUrl(token)}" width="960" height="540" frameborder="0" allowfullscreen></iframe>`

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <Link2 size={18} /> Share Presentation
          </h3>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
          {['links', 'embed'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                background: 'transparent', border: 'none', color: tab === t ? 'var(--accent, #6366f1)' : 'var(--text-muted)',
                borderBottom: tab === t ? '2px solid var(--accent, #6366f1)' : '2px solid transparent',
                fontWeight: tab === t ? 600 : 400,
              }}
            >
              {t === 'links' ? '🔗 Links' : '📋 Embed'}
            </button>
          ))}
        </div>

        {tab === 'links' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Loading...</div>
            ) : (
              <>
                {/* Existing shares table */}
                {shares.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>Name</th>
                          <th style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>Views</th>
                          <th style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>🔒</th>
                          <th style={{ textAlign: 'right', padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shares.map((s) => (
                          <tr key={s.token} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '8px 4px', color: 'var(--text)' }}>
                              {s.name || 'Shared Link'}
                              {s.expiresAt && (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                                  <Clock size={10} /> {new Date(s.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', padding: '8px 4px', color: 'var(--text-muted)' }}>
                              <Eye size={12} /> {s.views || 0}
                            </td>
                            <td style={{ textAlign: 'center', padding: '8px 4px' }}>
                              {s.isProtected ? <Lock size={12} color="var(--accent, #6366f1)" /> : '—'}
                            </td>
                            <td style={{ textAlign: 'right', padding: '8px 4px' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button
                                  className="btn-icon"
                                  title="Copy link"
                                  onClick={() => copyToClipboard(shareUrl(s.token), s.token)}
                                  style={{ padding: 4 }}
                                >
                                  {copied === s.token ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                                </button>
                                <button
                                  className="btn-icon"
                                  title="Delete"
                                  onClick={() => handleDelete(s.token)}
                                  style={{ padding: 4, color: 'var(--danger)' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>
                    No share links yet. Create one below.
                  </p>
                )}

                {/* New link form */}
                {showNewForm ? (
                  <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Link Name</label>
                      <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Client Review" style={field} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}><Lock size={10} /> Password (optional)</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Leave empty for no password" style={field} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}><Clock size={10} /> Expires in</label>
                        <select value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} style={field}>
                          <option value="">Never</option>
                          <option value="1">1 day</option>
                          <option value="7">7 days</option>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={handleCreate} disabled={creating} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        {creating ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Create Link
                      </button>
                      <button className="btn btn-secondary" onClick={() => setShowNewForm(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowNewForm(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Plus size={14} /> Create New Link
                  </button>
                )}
              </>
            )}
          </>
        )}

        {tab === 'embed' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Copy the embed code below to embed this presentation on any website.
            </p>
            {shares.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                Create a share link first to generate an embed code.
              </p>
            ) : (
              shares.map((s) => (
                <div key={s.token} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{s.name || 'Shared Link'}</label>
                  <div style={{ position: 'relative' }}>
                    <textarea
                      readOnly
                      value={embedCode(s.token)}
                      style={{ ...field, fontFamily: 'monospace', fontSize: 12, minHeight: 60, resize: 'none' }}
                    />
                    <button
                      className="btn-icon"
                      onClick={() => copyToClipboard(embedCode(s.token), `embed-${s.token}`)}
                      style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}
                      title="Copy embed code"
                    >
                      {copied === `embed-${s.token}` ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
