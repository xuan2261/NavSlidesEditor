/**
 * GamePropertiesQuestionEditor — modal for adding/editing quiz questions.
 * Used inside game-properties.jsx ContentTab.
 */
import { useEffect, useRef, useState, startTransition } from 'react'
import { X } from 'lucide-react'

export function GamePropertiesQuestionEditor({ isOpen, onSave, onCancel, question }) {
  const [form, setForm] = useState(() => buildDefaultForm(question))
  const [errors, setErrors] = useState({})
  const firstInputRef = useRef(null)
  const dialogRef = useRef(null)

  // Rebuild form when question prop changes
  useEffect(() => {
    startTransition(() => {
      setForm(buildDefaultForm(question))
      setErrors({})
    })
  }, [question, isOpen])

  // Focus first input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => firstInputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Escape key closes modal
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const updateOption = (idx, value) => {
    const newOptions = [...form.options]
    newOptions[idx] = value
    setForm(f => ({ ...f, options: newOptions }))
  }

  const validate = () => {
    const errs = {}
    if (!form.question.trim()) errs.question = 'Question text is required'
    const filledOptions = form.options.filter(o => o.trim())
    if (filledOptions.length < 2) errs.options = 'At least 2 options are required'
    return errs
  }

  const handleSave = () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave({ ...form })
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qeditor-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="qeditor-title" className="text-sm font-semibold text-text-primary">
            {question ? 'Edit Question' : 'Add Question'}
          </h2>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="text-text-muted hover:text-text-primary p-1 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Question text */}
          <div>
            <label className="block text-[11px] text-text-muted mb-1 font-medium uppercase tracking-wide">
              Question <span className="text-red-400">*</span>
            </label>
            <textarea
              ref={firstInputRef}
              value={form.question}
              onChange={e => { setForm(f => ({ ...f, question: e.target.value })); setErrors(er => ({ ...er, question: '' })) }}
              placeholder="Enter your question..."
              rows={2}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none resize-y"
            />
            {errors.question && <p className="text-[11px] text-red-400 mt-0.5">{errors.question}</p>}
          </div>

          {/* Options */}
          <div>
            <label className="block text-[11px] text-text-muted mb-1 font-medium uppercase tracking-wide">
              Options <span className="text-red-400">*</span>
            </label>
            <div className="space-y-1.5">
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[10px] font-bold cursor-pointer transition-colors ${form.correctIndex === idx ? 'bg-green-500 border-green-500 text-white' : 'border-border text-text-muted hover:border-accent'}`}
                    onClick={() => setForm(f => ({ ...f, correctIndex: idx }))}
                    title="Mark as correct"
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <input
                    type="text"
                    value={opt}
                    onChange={e => { updateOption(idx, e.target.value); setErrors(er => ({ ...er, options: '' })) }}
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    className="flex-1 bg-surface-2 border border-border rounded px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              ))}
            </div>
            {errors.options && <p className="text-[11px] text-red-400 mt-0.5">{errors.options}</p>}
            <p className="text-[10px] text-text-muted mt-1">Click the letter to mark the correct answer</p>
          </div>

          {/* Time & Points */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-text-muted mb-1 font-medium uppercase tracking-wide">
                Time Limit (s)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={form.timeLimit}
                onChange={e => setForm(f => ({ ...f, timeLimit: parseInt(e.target.value, 10) || 30 }))}
                className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1 font-medium uppercase tracking-wide">
                Points
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.points}
                onChange={e => setForm(f => ({ ...f, points: parseInt(e.target.value, 10) || 10 }))}
                className="w-full bg-surface-2 border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-surface-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary border border-border rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export function buildDefaultForm(question) {
  if (question) {
    return {
      id: question.id,
      question: question.question || '',
      options: [...(question.options || ['', '', '', ''])],
      correctIndex: question.correctIndex ?? 0,
      timeLimit: question.timeLimit ?? 30,
      points: question.points ?? 10,
    }
  }
  return {
    id: `q-${Date.now()}`,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimit: 30,
    points: 10,
  }
}
