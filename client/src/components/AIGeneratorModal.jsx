import { useState } from 'react'
import { Sparkles, X, Loader2, FileText, Edit3, Check } from 'lucide-react'
import { aiGenerateOutline } from '../utils/ai'

const STYLES = ['Professional', 'Academic', 'Casual', 'Military Briefing', 'Technical', 'Creative']
const LANGUAGES = ['English', 'Tiếng Việt', 'Japanese', 'Korean', 'Chinese', 'French', 'German', 'Spanish', 'Russian']

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

export default function AIGeneratorModal({ onCreatePresentation, onClose }) {
  const [topic, setTopic] = useState('')
  const [slideCount, setSlideCount] = useState(8)
  const [style, setStyle] = useState('Professional')
  const [language, setLanguage] = useState('English')
  const [outline, setOutline] = useState(null)
  const [editingOutline, setEditingOutline] = useState(false)
  const [outlineText, setOutlineText] = useState('')
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setLoading(true); setError(''); setOutline(null)
    try {
      const data = await aiGenerateOutline(topic, slideCount, style, language)
      setOutline(data.outline)
      setOutlineText(JSON.stringify(data.outline, null, 2))
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const handleCreate = async () => {
    setCreating(true); setError('')
    try {
      let finalOutline = outline
      if (editingOutline) {
        try { finalOutline = JSON.parse(outlineText) } catch { setError('Invalid JSON'); setCreating(false); return }
      }
      onCreatePresentation(finalOutline)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally { setCreating(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <FileText size={18} /> AI Slide Generator
          </h3>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={16} /></button>
        </div>

        {!outline ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Topic or description</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. IoT Security in Military Systems — threats, defense strategies, case studies"
                style={{ ...field, minHeight: 80, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Slides</label>
                <select value={slideCount} onChange={(e) => setSlideCount(+e.target.value)} style={field}>
                  {[5, 6, 7, 8, 10, 12, 15].map(n => <option key={n} value={n}>{n} slides</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Style</label>
                <select value={style} onChange={(e) => setStyle(e.target.value)} style={field}>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} style={field}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {loading ? <><Loader2 size={14} className="spin" /> Generating Outline...</> : <><Sparkles size={14} /> Generate Outline</>}
            </button>

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</div>}
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Generated Outline ({outline.length} slides)</label>
                <button
                  className="btn-icon"
                  onClick={() => setEditingOutline(!editingOutline)}
                  style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Edit3 size={12} /> {editingOutline ? 'Preview' : 'Edit JSON'}
                </button>
              </div>

              {editingOutline ? (
                <textarea
                  value={outlineText}
                  onChange={(e) => setOutlineText(e.target.value)}
                  style={{ ...field, minHeight: 250, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                />
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-secondary)' }}>
                  {outline.map((slide, i) => (
                    <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < outline.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                        {i + 1}. {slide.title}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>({slide.layout})</span>
                      </div>
                      {slide.bulletPoints?.length > 0 && (
                        <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                          {slide.bulletPoints.map((bp, j) => <li key={j}>{bp}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={creating}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {creating ? <><Loader2 size={14} className="spin" /> Creating...</> : <><Check size={14} /> Create Presentation</>}
              </button>
              <button className="btn btn-secondary" onClick={() => { setOutline(null); setOutlineText('') }}>
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
