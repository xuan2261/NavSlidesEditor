import { useState } from 'react'
import { Languages, X, Loader2 } from 'lucide-react'
import { aiTranslate } from '../utils/ai'

const LANGUAGES = [
  'English', 'Tiếng Việt', '日本語', '한국어', '中文', 'Français',
  'Deutsch', 'Español', 'Русский', 'ภาษาไทย', 'Italiano', 'Português',
  'العربية', 'हिन्दी', 'Bahasa Indonesia', 'Bahasa Melayu',
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
  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
}

export default function AITranslateModal({ slides, onApplyTranslations, onClose }) {
  const [targetLang, setTargetLang] = useState('Tiếng Việt')
  const [translateContent, setTranslateContent] = useState(true)
  const [translateNotes, setTranslateNotes] = useState(true)
  const [keepOriginalAsNotes, setKeepOriginalAsNotes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  // Extract all translatable text from slides
  const extractTexts = () => {
    const texts = []
    if (!slides) return texts
    slides.forEach((slide, si) => {
      if (translateContent && slide.elements) {
        slide.elements.forEach((el, ei) => {
          if (el.type === 'text' && el.content) {
            texts.push({ slideIdx: si, elementIdx: ei, field: 'content', html: el.content })
          }
        })
      }
      if (translateNotes && slide.speakerNotes) {
        texts.push({ slideIdx: si, field: 'speakerNotes', html: slide.speakerNotes })
      }
    })
    return texts
  }

  const handleTranslate = async () => {
    setLoading(true); setError(''); setProgress('Extracting text...')
    try {
      const texts = extractTexts()
      if (texts.length === 0) { setError('No text found to translate'); setLoading(false); return }

      // Batch translate in chunks of 20
      const chunkSize = 20
      const results = []
      for (let i = 0; i < texts.length; i += chunkSize) {
        setProgress(`Translating ${i + 1}-${Math.min(i + chunkSize, texts.length)} of ${texts.length}...`)
        const chunk = texts.slice(i, i + chunkSize)
        const payload = chunk.map(t => ({ id: `${t.slideIdx}-${t.elementIdx || 'notes'}-${t.field}`, html: t.html }))
        const data = await aiTranslate(payload, targetLang)
        results.push(...data.translations)
      }

      // Map results back to slide structure
      const translationMap = {}
      // eslint-disable-next-line unused-imports/no-unused-vars
      texts.forEach((t, idx) => {
        const key = `${t.slideIdx}-${t.elementIdx || 'notes'}-${t.field}`
        const translated = results.find(r => r.id === key)
        if (translated) {
          translationMap[key] = { ...t, translatedHtml: translated.html }
        }
      })

      onApplyTranslations(translationMap, keepOriginalAsNotes)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false); setProgress('') }
  }

  const textCount = extractTexts().length

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
            <Languages size={18} /> Translate Presentation
          </h3>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={16} /></button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Target Language</label>
          <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={field}>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text)' }}>
            <input type="checkbox" checked={translateContent} onChange={(e) => setTranslateContent(e.target.checked)} />
            Translate slide content
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text)' }}>
            <input type="checkbox" checked={translateNotes} onChange={(e) => setTranslateNotes(e.target.checked)} />
            Translate speaker notes
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text)' }}>
            <input type="checkbox" checked={keepOriginalAsNotes} onChange={(e) => setKeepOriginalAsNotes(e.target.checked)} />
            Keep original text as speaker notes
          </label>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Found <strong>{textCount}</strong> text elements to translate across {slides?.length || 0} slides.
        </p>

        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {progress && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{progress}</div>}

        <button
          className="btn btn-primary"
          onClick={handleTranslate}
          disabled={loading || textCount === 0}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {loading ? <><Loader2 size={14} className="spin" /> Translating...</> : <><Languages size={14} /> Translate All</>}
        </button>
      </div>
    </div>
  )
}
