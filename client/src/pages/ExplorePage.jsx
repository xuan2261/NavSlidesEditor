import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Globe, Layers, Calendar, ExternalLink, Copy } from 'lucide-react'

export default function ExplorePage() {
  const navigate = useNavigate()
  const [presentations, setPresentations] = useState([])
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetch('/api/explore')
      .then(r => r.json())
      .then(data => { setPresentations(data.presentations || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleFork = async (presId) => {
    // Find the share token for this presentation
    try {
      const res = await fetch(`/api/presentations/${presId}/shares`)
      const data = await res.json()
      const token = data.shares?.[0]?.token
      if (!token) { alert('No share token found'); return }
      
      const forkRes = await fetch(`/api/explore/${token}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const forkData = await forkRes.json()
      if (forkData.presentation) {
        navigate(`/editor/${forkData.presentation.id}`)
      }
    } catch (err) { alert('Fork failed: ' + err.message) }
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ padding: '6px 10px' }}>
            <ChevronLeft size={16} />
          </button>
          <h1 style={{ fontSize: 20 }}>
            <Globe size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Explore Public Presentations
          </h1>
        </div>
      </div>

      <div className="home-content" style={{ maxWidth: 960, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
        ) : presentations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Globe size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 16 }}>No public presentations yet</p>
            <p style={{ fontSize: 13 }}>Share a presentation to make it appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {presentations.map(p => (
              <div
                key={p.id}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 16, cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {/* Thumbnail placeholder */}
                <div style={{
                  height: 140, borderRadius: 8, marginBottom: 12,
                  background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-hover))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, color: 'var(--text-muted)', opacity: 0.5,
                }}>
                  <Layers size={32} />
                </div>

                <h3 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--text)', lineHeight: 1.3 }}>
                  {p.title}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span><Layers size={12} /> {p.slideCount} slides</span>
                  <span><Calendar size={12} /> {new Date(p.createdAt).toLocaleDateString()}</span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => { e.stopPropagation(); handleFork(p.id) }}
                    style={{ flex: 1, fontSize: 12, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    <Copy size={12} /> Fork
                  </button>
                  <a
                    href={`/api/presentations/${p.id}/present`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, fontSize: 12, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <ExternalLink size={12} /> View
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
