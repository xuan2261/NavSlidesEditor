import { useState } from 'react'
import { Languages, X, Loader2 } from 'lucide-react'
import { aiTranslate } from '../utils/ai'
import { Button } from '../components/ui'
import { isBackdropClick, useEscapeClose } from '../lib/utils'
import { getSlideNotes, getSlideNotesTranslationKey } from '../utils/slide-notes'

const LANGUAGES = [
  'English',
  'Tiếng Việt',
  '日本語',
  '한국어',
  '中文',
  'Français',
  'Deutsch',
  'Español',
  'Русский',
  'ภาษาไทย',
  'Italiano',
  'Português',
  'العربية',
  'हिन्दी',
  'Bahasa Indonesia',
  'Bahasa Melayu',
]

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
      const notes = getSlideNotes(slide)
      if (translateNotes && notes) {
        texts.push({ slideIdx: si, field: 'notes', html: notes })
      }
    })
    return texts
  }

  const handleTranslate = async () => {
    setLoading(true)
    setError('')
    setProgress('Extracting text...')
    try {
      const texts = extractTexts()
      if (texts.length === 0) {
        setError('No text found to translate')
        setLoading(false)
        return
      }

      // Batch translate in chunks of 20
      const chunkSize = 20
      const results = []
      for (let i = 0; i < texts.length; i += chunkSize) {
        setProgress(
          `Translating ${i + 1}-${Math.min(i + chunkSize, texts.length)} of ${texts.length}...`
        )
        const chunk = texts.slice(i, i + chunkSize)
        const payload = chunk.map((t) => ({
          id:
            t.field === 'notes'
              ? getSlideNotesTranslationKey(t.slideIdx)
              : `${t.slideIdx}-${t.elementIdx || 'notes'}-${t.field}`,
          html: t.html,
        }))
        const data = await aiTranslate(payload, targetLang)
        results.push(...data.translations)
      }

      // Map results back to slide structure
      const translationMap = {}
      // eslint-disable-next-line unused-imports/no-unused-vars
      texts.forEach((t, idx) => {
        const key =
          t.field === 'notes'
            ? getSlideNotesTranslationKey(t.slideIdx)
            : `${t.slideIdx}-${t.elementIdx || 'notes'}-${t.field}`
        const translated = results.find((r) => r.id === key)
        if (translated) {
          translationMap[key] = { ...t, translatedHtml: translated.html }
        }
      })

      onApplyTranslations(translationMap, keepOriginalAsNotes)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  const textCount = extractTexts().length

  useEscapeClose(onClose)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]"
      onClick={(event) => {
        if (isBackdropClick(event)) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-translate-modal-title"
    >
      <div
        className="bg-card rounded-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl border border-border"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="ai-translate-modal-title" className="m-0 flex items-center gap-2 text-base">
            <Languages size={18} /> Translate Presentation
          </h3>
          <Button variant="icon" onClick={onClose} className="p-1" aria-label="Close">
            <X size={16} />
          </Button>
        </div>

        <div className="mb-4">
          <label className="text-xs text-text-muted block mb-1">Target Language</label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm box-border"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex flex-col gap-2">
          <label className="text-[13px] flex items-center gap-2 cursor-pointer text-text-primary">
            <input
              type="checkbox"
              checked={translateContent}
              onChange={(e) => setTranslateContent(e.target.checked)}
              className="rounded border-border"
            />
            Translate slide content
          </label>
          <label className="text-[13px] flex items-center gap-2 cursor-pointer text-text-primary">
            <input
              type="checkbox"
              checked={translateNotes}
              onChange={(e) => setTranslateNotes(e.target.checked)}
              className="rounded border-border"
            />
            Translate speaker notes
          </label>
          <label className="text-[13px] flex items-center gap-2 cursor-pointer text-text-primary">
            <input
              type="checkbox"
              checked={keepOriginalAsNotes}
              onChange={(e) => setKeepOriginalAsNotes(e.target.checked)}
              className="rounded border-border"
            />
            Keep original text as speaker notes
          </label>
        </div>

        <p className="text-xs text-text-muted mb-4">
          Found <strong>{textCount}</strong> text elements to translate across {slides?.length || 0}{' '}
          slides.
        </p>

        {error && <div className="text-danger text-[13px] mb-3">{error}</div>}
        {progress && <div className="text-xs text-text-muted mb-3">{progress}</div>}

        <Button
          variant="primary"
          onClick={handleTranslate}
          disabled={loading || textCount === 0}
          className="w-full flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Translating...
            </>
          ) : (
            <>
              <Languages size={14} /> Translate All
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
