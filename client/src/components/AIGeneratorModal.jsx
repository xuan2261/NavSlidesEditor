import { useState } from 'react'
import { Sparkles, X, Loader2, FileText, Edit3, Check } from 'lucide-react'
import { aiGenerateOutline } from '../utils/ai'
import { Button } from '../components/ui'

const STYLES = ['Professional', 'Academic', 'Casual', 'Military Briefing', 'Technical', 'Creative']
const LANGUAGES = [
  'English',
  'Tiếng Việt',
  'Japanese',
  'Korean',
  'Chinese',
  'French',
  'German',
  'Spanish',
  'Russian',
]

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
    setLoading(true)
    setError('')
    setOutline(null)
    try {
      const data = await aiGenerateOutline(topic, slideCount, style, language)
      setOutline(data.outline)
      setOutlineText(JSON.stringify(data.outline, null, 2))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      let finalOutline = outline
      if (editingOutline) {
        try {
          finalOutline = JSON.parse(outlineText)
        } catch {
          setError('Invalid JSON')
          setCreating(false)
          return
        }
      }
      onCreatePresentation(finalOutline)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl p-6 w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 flex items-center gap-2 text-base">
            <FileText size={18} /> AI Slide Generator
          </h3>
          <Button variant="icon" onClick={onClose} className="p-1">
            <X size={16} />
          </Button>
        </div>

        {!outline ? (
          <>
            <div className="mb-3">
              <label className="text-xs text-text-muted block mb-1">Topic or description</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. IoT Security in Military Systems — threats, defense strategies, case studies"
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text text-sm min-h-[80px] resize-y"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-text-muted block mb-1">Slides</label>
                <select
                  value={slideCount}
                  onChange={(e) => setSlideCount(+e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text text-sm box-border"
                >
                  {[5, 6, 7, 8, 10, 12, 15].map((n) => (
                    <option key={n} value={n}>
                      {n} slides
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Style</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text text-sm box-border"
                >
                  {STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text text-sm box-border"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={loading || !topic.trim()}
              className="w-full flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Generating Outline...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Generate Outline
                </>
              )}
            </Button>

            {error && <div className="text-danger text-[13px] mt-2">{error}</div>}
          </>
        ) : (
          <>
            <div className="mb-3">
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs text-text-muted">
                  Generated Outline ({outline.length} slides)
                </label>
                <Button
                  variant="ghost"
                  onClick={() => setEditingOutline(!editingOutline)}
                  className="px-2 py-0.5 text-[11px] flex items-center gap-1 border border-border bg-secondary rounded hover:bg-hover"
                >
                  <Edit3 size={12} /> {editingOutline ? 'Preview' : 'Edit JSON'}
                </Button>
              </div>

              {editingOutline ? (
                <textarea
                  value={outlineText}
                  onChange={(e) => setOutlineText(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text text-xs min-h-[250px] font-mono resize-y"
                />
              ) : (
                <div className="max-h-[300px] overflow-y-auto border border-border rounded-lg p-3 bg-secondary">
                  {outline.map((slide, i) => (
                    <div
                      key={i}
                      className={`mb-3 pb-3 ${i < outline.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <div className="text-[13px] font-semibold text-text mb-1">
                        {i + 1}. {slide.title}
                        <span className="text-[11px] text-text-muted ml-2">({slide.layout})</span>
                      </div>
                      {slide.bulletPoints?.length > 0 && (
                        <ul className="m-0 mt-1 pl-4 text-xs text-text-muted list-disc">
                          {slide.bulletPoints.map((bp, j) => (
                            <li key={j}>{bp}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="text-danger text-[13px] mb-2">{error}</div>}

            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                {creating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Create Presentation
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setOutline(null)
                  setOutlineText('')
                }}
              >
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
