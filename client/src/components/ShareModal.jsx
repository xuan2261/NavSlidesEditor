import { useState, useEffect, useCallback } from 'react'
import { Link2, X, Copy, Trash2, Plus, Lock, Clock, Eye, Loader2, Check } from 'lucide-react'
import { Button } from '../components/ui'
import { isBackdropClick } from '../lib/utils'

export default function ShareModal({ presentationId, onClose }) {
  const [isOpen, setIsOpen] = useState(true)
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

  const loadShares = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/presentations/${presentationId}/shares`)
      const data = await res.json()
      setShares(data.shares || [])
    } catch (err) {
      console.error('Failed to load shares', err)
    } finally {
      setLoading(false)
    }
  }, [presentationId])

  useEffect(() => {
    loadShares()
  }, [loadShares])

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

      setNewName('')
      setNewPassword('')
      setNewExpiry('')
      setShowNewForm(false)
      loadShares()
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (token) => {
    if (!confirm('Delete this share link?')) return
    try {
      const res = await fetch(`/api/shares/${token}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete share link')
      loadShares()
    } catch (err) {
      alert(err.message)
    }
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const shareUrl = (token) => `${window.location.origin}/share/${token}`
  const embedCode = (token) =>
    `<iframe src="${shareUrl(token)}" width="960" height="540" frameborder="0" allowfullscreen></iframe>`

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        className="bg-card rounded-xl p-6 w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl border border-border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="share-modal-title" className="m-0 flex items-center gap-2 text-base text-text-primary">
            <Link2 size={18} /> Share Presentation
          </h3>
          <Button variant="ghost" onClick={handleClose} className="p-1" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 mb-4 border-b border-border">
          {['links', 'embed'].map((t) => (
            <Button
              variant="ghost"
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-[13px] rounded-none border-b-2 ${tab === t ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-muted hover:text-text-primary font-normal'}`}
            >
              {t === 'links' ? '🔗 Links' : '📋 Embed'}
            </Button>
          ))}
        </div>

        {tab === 'links' && (
          <>
            {loading ? (
              <div className="text-center p-5 text-text-muted">Loading...</div>
            ) : (
              <>
                {/* Existing shares table */}
                {shares.length > 0 ? (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="py-2 px-1 text-text-muted font-medium">Name</th>
                          <th className="text-center py-2 px-1 text-text-muted font-medium">
                            Views
                          </th>
                          <th className="text-center py-2 px-1 text-text-muted font-medium">🔒</th>
                          <th className="text-right py-2 px-1 text-text-muted font-medium">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shares.map((s) => (
                          <tr key={s.token} className="border-b border-border">
                            <td className="py-2 px-1 text-text-primary">
                              {s.name || 'Shared Link'}
                              {s.expiresAt && (
                                <span className="text-[11px] text-text-muted ml-1.5 inline-flex items-center gap-1">
                                  <Clock size={10} /> {new Date(s.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </td>
                            <td className="text-center py-2 px-1 text-text-muted">
                              <Eye size={12} className="inline mr-1" /> {s.views || 0}
                            </td>
                            <td className="text-center py-2 px-1">
                              {s.isProtected ? (
                                <Lock size={12} className="text-accent mx-auto" />
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="text-right py-2 px-1">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="icon"
                                  title="Copy link"
                                  onClick={() => copyToClipboard(shareUrl(s.token), s.token)}
                                  className="p-1"
                                >
                                  {copied === s.token ? (
                                    <Check size={14} className="text-[#22c55e]" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </Button>
                                <Button
                                  variant="icon"
                                  title="Delete"
                                  onClick={() => handleDelete(s.token)}
                                  className="p-1 text-danger hover:bg-danger/10"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-text-muted text-[13px] text-center p-4">
                    No share links yet. Create one below.
                  </p>
                )}

                {/* New link form */}
                {showNewForm ? (
                  <div className="p-3 border border-border rounded-lg bg-secondary">
                    <div className="mb-2">
                      <label className="text-xs text-text-muted block mb-1">Link Name</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Client Review"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-text-muted flex items-center gap-1 mb-1">
                          <Lock size={10} /> Password (optional)
                        </label>
                        <input
                          type="password"
                          className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Leave empty for no password"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-text-muted flex items-center gap-1 mb-1">
                          <Clock size={10} /> Expires in
                        </label>
                        <select
                          className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm focus:border-accent focus:outline-none transition-colors"
                          value={newExpiry}
                          onChange={(e) => setNewExpiry(e.target.value)}
                        >
                          <option value="">Never</option>
                          <option value="1">1 day</option>
                          <option value="7">7 days</option>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        onClick={handleCreate}
                        disabled={creating}
                        className="flex-1 flex items-center justify-center gap-1.5"
                      >
                        {creating ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}{' '}
                        Create Link
                      </Button>
                      <Button variant="secondary" onClick={() => setShowNewForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => setShowNewForm(true)}
                    className="w-full flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Create New Link
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {tab === 'embed' && (
          <div>
            <p className="text-[13px] text-text-muted mb-3">
              Copy the embed code below to embed this presentation on any website.
            </p>
            {shares.length === 0 ? (
              <p className="text-[13px] text-text-muted text-center p-4">
                Create a share link first to generate an embed code.
              </p>
            ) : (
              shares.map((s) => (
                <div key={s.token} className="mb-3">
                  <label className="text-xs text-text-muted block mb-1">
                    {s.name || 'Shared Link'}
                  </label>
                  <div className="relative">
                    <textarea
                      readOnly
                      value={embedCode(s.token)}
                      className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-xs font-mono min-h-[60px] resize-none focus:outline-none focus:border-accent"
                    />
                    <Button
                      variant="icon"
                      onClick={() => copyToClipboard(embedCode(s.token), `embed-${s.token}`)}
                      className="absolute top-2 right-2 p-1"
                      title="Copy embed code"
                    >
                      {copied === `embed-${s.token}` ? (
                        <Check size={14} className="text-[#22c55e]" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </Button>
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
