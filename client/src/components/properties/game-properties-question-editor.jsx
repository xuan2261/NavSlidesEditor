import { useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createCanonicalQuestion, validateCanonicalQuestion } from 'revealjs-shared'
import { useModalFocusTrap } from '../ui/ModalShell'
import QuestionFields from './game-question-fields'

export function GamePropertiesQuestionEditor(props) {
  if (!props.isOpen) return null
  return <OpenQuestionEditor key={props.question?.id || 'new'} {...props} />
}

function OpenQuestionEditor({ question, onSave, onCancel }) {
  const [form, setForm] = useState(() =>
    question ? structuredClone(question) : createCanonicalQuestion({ prompt: '' })
  )
  const [errors, setErrors] = useState([])
  const firstInputRef = useRef(null)
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({
    initialFocusRef: firstInputRef,
  })
  const titleId = useId()
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onCancel()
    } else handleFocusTrapKeyDown(event)
  }
  const save = () => {
    const result = validateCanonicalQuestion(form)
    setErrors(result.errors)
    if (result.isValid) onSave(structuredClone(form))
  }
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id={titleId} className="text-sm font-semibold text-text-primary">
            {question ? 'Edit Question' : 'Add Question'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close question editor"
            className="text-text-muted hover:text-text-primary p-1 rounded"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3 max-h-[65vh] overflow-y-auto">
          <QuestionFields
            value={form}
            onChange={(next) => {
              setForm(next)
              setErrors([])
            }}
            errors={errors}
            initialFocusRef={firstInputRef}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-border text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="px-3 py-1.5 rounded bg-accent text-white text-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
