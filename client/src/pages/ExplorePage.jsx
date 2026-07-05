import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Globe, Layers, Calendar, ExternalLink, Copy } from 'lucide-react'
import { Button } from '../components/ui'
import { showError } from '../utils/app-feedback'

export default function ExplorePage() {
  const navigate = useNavigate()
  const [presentations, setPresentations] = useState([])
  const [loading, setLoading] = useState(true)
  // eslint-disable-next-line unused-imports/no-unused-vars
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetch('/api/explore')
      .then((r) => r.json())
      .then((data) => {
        setPresentations(data.presentations || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleFork = async (presId) => {
    // Find the share token for this presentation
    try {
      const res = await fetch(`/api/presentations/${presId}/shares`)
      const data = await res.json()
      const token = data.shares?.[0]?.token
      if (!token) {
        showError('No share token found')
        return
      }

      const forkRes = await fetch(`/api/explore/${token}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const forkData = await forkRes.json()
      if (forkData.presentation) {
        navigate(`/editor/${forkData.presentation.id}`)
      }
    } catch (err) {
      showError('Fork failed: ' + err.message)
    }
  }

  return (
    <div className="h-full flex flex-col bg-panel">
      <div className="flex items-center justify-between px-6 h-14 border-b border-border bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/')} className="px-2.5 py-1.5">
            <ChevronLeft size={16} />
          </Button>
          <h1 className="text-xl">
            <Globe size={20} className="inline-block mr-2 align-middle" />
            Explore Public Presentations
          </h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-7 px-8 pb-7 max-w-[960px] mx-auto">
        {loading ? (
          <div className="text-center p-10 text-text-muted">
            Loading...
          </div>
        ) : presentations.length === 0 ? (
          <div className="text-center py-[60px] text-text-muted">
            <Globe size={48} className="opacity-30 mb-3 inline-block" />
            <p className="text-base">No public presentations yet</p>
            <p className="text-[13px]">Share a presentation to make it appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {presentations.map((p) => (
              <div
                key={p.id}
                className="cursor-pointer rounded-xl border border-border bg-card p-4 transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-[0_12px_28px_rgba(36,25,21,0.14)] focus-within:ring-2 focus-within:ring-focus/25"
              >
                {/* Thumbnail placeholder */}
                <div className="h-[140px] rounded-lg mb-3 bg-gradient-to-br from-secondary to-hover flex items-center justify-center text-[32px] text-text-muted opacity-50">
                  <Layers size={32} />
                </div>

                <h3 className="mb-2 text-[15px] text-text-primary leading-snug">
                  {p.title}
                </h3>
                <div className="flex justify-between items-center text-xs text-text-muted">
                  <span>
                    <Layers size={12} className="inline-block mr-1" /> {p.slideCount} slides
                  </span>
                  <span>
                    <Calendar size={12} className="inline-block mr-1" /> {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-1.5 mt-3">
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFork(p.id)
                    }}
                    className="flex-1 text-xs py-1.5 px-2 flex items-center justify-center gap-1"
                  >
                    <Copy size={12} /> Fork
                  </Button>
                  <a
                    href={`/api/presentations/${p.id}/present`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs py-1.5 px-2 flex items-center justify-center gap-1 bg-accent text-white rounded hover:bg-accent/90 transition-colors no-underline"
                    onClick={(e) => e.stopPropagation()}
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
