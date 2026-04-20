import { useState } from 'react'
import { Sparkles, X, RotateCw, Check, Loader2 } from 'lucide-react'
import { aiRewrite } from '../utils/ai'

const ACTIONS = [
  { id: 'improve', label: 'Improve', icon: '✨' },
  { id: 'shorten', label: 'Shorten', icon: '📏' },
  { id: 'expand', label: 'Expand', icon: '📖' },
  { id: 'professional', label: 'Professional', icon: '👔' },
  { id: 'casual', label: 'Casual', icon: '😊' },
  { id: 'grammar', label: 'Fix Grammar', icon: '📝' },
]

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000,
}
const modal = {
  background: 'var(--bg-card)', borderRadius: 12, padding: 24,
  width: 480, maxHeight: '80vh', overflowY: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)',
}
const field = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid var(--border)', background: 'var(--bg-secondary)',
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box', resize: 'vertical',
}

export default function AICopywriterModal({ text, onApply, onClose }) {
  const [action, setAction] = useState('improve')
  const [customPrompt, setCustomPrompt] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true); setError(''); setResult('')
    try {
      const data = await aiRewrite(text, action === 'custom' ? 'custom' : action, customPrompt)
      setResult(data.result)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <Sparkles size={18} /> AI Copywriter
          </h3>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Selected text</label>
          <div style={{ ...field, background: 'var(--bg-hover)', minHeight: 40, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {text || '(No text selected)'}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Action</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAction(a.id)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: action === a.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: action === a.id ? 'var(--accent-muted, rgba(99,102,241,0.15))' : 'var(--bg-secondary)',
                  color: 'var(--text)',
                }}
              >
                {a.icon} {a.label}
              </button>
            ))}
            <button
              onClick={() => setAction('custom')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                border: action === 'custom' ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: action === 'custom' ? 'var(--accent-muted, rgba(99,102,241,0.15))' : 'var(--bg-secondary)',
                color: 'var(--text)',
              }}
            >
              🎯 Custom
            </button>
          </div>
        </div>

        {action === 'custom' && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Custom prompt</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Make it more dramatic and add bullet points"
              style={{ ...field, minHeight: 60 }}
            />
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || !text}
          style={{ width: '100%', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {loading ? <><Loader2 size={14} className="spin" /> Generating...</> : <><Sparkles size={14} /> Generate</>}
        </button>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {result && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Result</label>
            <div style={{ ...field, background: 'var(--bg-hover)', minHeight: 60, whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {result}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => { onApply(result); onClose() }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Check size={14} /> Apply
              </button>
              <button className="btn btn-secondary" onClick={handleGenerate} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RotateCw size={14} /> Regenerate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
