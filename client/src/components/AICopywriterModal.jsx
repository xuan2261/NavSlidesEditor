import { useState } from 'react'
import { Sparkles, X, RotateCw, Check, Loader2 } from 'lucide-react'
import { aiRewrite } from '../utils/ai'
import { Button } from '../components/ui'

const ACTIONS = [
  { id: 'improve', label: 'Improve', icon: '✨' },
  { id: 'shorten', label: 'Shorten', icon: '📏' },
  { id: 'expand', label: 'Expand', icon: '📖' },
  { id: 'professional', label: 'Professional', icon: '👔' },
  { id: 'casual', label: 'Casual', icon: '😊' },
  { id: 'grammar', label: 'Fix Grammar', icon: '📝' },
]

export default function AICopywriterModal({ text, onApply, onClose }) {
  const [action, setAction] = useState('improve')
  const [customPrompt, setCustomPrompt] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setResult('')
    try {
      const data = await aiRewrite(text, action === 'custom' ? 'custom' : action, customPrompt)
      setResult(data.result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto shadow-2xl border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="m-0 flex items-center gap-2 text-base">
            <Sparkles size={18} /> AI Copywriter
          </h3>
          <Button variant="icon" onClick={onClose} className="p-1">
            <X size={16} />
          </Button>
        </div>

        <div className="mb-3">
          <label className="text-xs text-text-muted block mb-1">Selected text</label>
          <div className="w-full px-3 py-2 rounded-md border border-border bg-hover text-text-primary text-[13px] min-h-[40px] whitespace-pre-wrap">
            {text || '(No text selected)'}
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs text-text-muted block mb-1.5">Action</label>
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => (
              <Button
                variant="ghost"
                key={a.id}
                onClick={() => setAction(a.id)}
                className={`px-3 py-1.5 rounded-md text-xs cursor-pointer border ${action === a.id ? 'border-accent bg-accent/15' : 'border-border bg-secondary'} text-text`}
              >
                {a.icon} {a.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              onClick={() => setAction('custom')}
              className={`px-3 py-1.5 rounded-md text-xs cursor-pointer border ${action === 'custom' ? 'border-accent bg-accent/15' : 'border-border bg-secondary'} text-text`}
            >
              🎯 Custom
            </Button>
          </div>
        </div>

        {action === 'custom' && (
          <div className="mb-3">
            <label className="text-xs text-text-muted block mb-1">Custom prompt</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Make it more dramatic and add bullet points"
              className="w-full px-3 py-2 rounded-md border border-border bg-secondary text-text-primary text-sm resize-y min-h-[60px]"
            />
          </div>
        )}

        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={loading || !text}
          className="w-full mb-3 flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles size={14} /> Generate
            </>
          )}
        </Button>

        {error && <div className="text-danger text-[13px] mb-3">{error}</div>}

        {result && (
          <div className="mb-3">
            <label className="text-xs text-text-muted block mb-1">Result</label>
            <div className="w-full px-3 py-2 rounded-md border border-border bg-hover text-text-primary text-[13px] min-h-[60px] whitespace-pre-wrap">
              {result}
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="primary"
                onClick={() => {
                  onApply(result)
                  onClose()
                }}
                className="flex-1 flex items-center justify-center gap-1.5"
              >
                <Check size={14} /> Apply
              </Button>
              <Button
                variant="secondary"
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-1.5"
              >
                <RotateCw size={14} /> Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
