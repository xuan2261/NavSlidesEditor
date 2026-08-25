import { useEffect, useId, useRef, useState } from 'react'
import { useModalFocusTrap } from './ui/ModalShell'
import { cn, useEscapeClose } from '../lib/utils'
import { Button, Input } from './ui'


/** Accessible modal replacement for browser-native text entry. */
export default function PromptPopover({
  title,
  label = title,
  description,
  defaultValue = '',
  placeholder = '',
  submitLabel = 'OK',
  validate,
  onSubmit,
  onCancel,
  className = '',
  style,
}) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap({ initialFocusRef: inputRef })
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()

  useEffect(() => {
    inputRef.current?.select()
  }, [])

  useEscapeClose(onCancel)

  const handleSubmit = () => {
    const trimmedValue = value.trim()
    const validationError = validate?.(trimmedValue)
    if (validationError) {
      setError(validationError)
      inputRef.current?.focus()
      return
    }
    if (trimmedValue) onSubmit(trimmedValue)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && event.target === inputRef.current) {
      event.preventDefault()
      handleSubmit()
      return
    }
    handleFocusTrapKeyDown(event)
  }

  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div className="fixed inset-0 z-[9998]">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onMouseDown={onCancel} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        onKeyDown={handleKeyDown}
        className={cn(
          'absolute z-10 min-w-[240px] rounded-lg border border-border bg-card p-3 text-text-primary shadow-lg',
          className
        )}
        style={style}
      >
        <h2 id={titleId} className="text-xs font-semibold mb-2">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mb-2 text-[11px] text-text-muted">
            {description}
          </p>
        )}
        <label className="mb-1 block text-[11px] text-text-secondary" htmlFor={`${titleId}-input`}>
          {label}
        </label>
        <Input
          id={`${titleId}-input`}
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError('')
          }}
          placeholder={placeholder}
          aria-invalid={error ? 'true' : undefined}
          aria-errormessage={error ? errorId : undefined}
          aria-describedby={describedBy}
          className="min-h-8 px-2.5 py-1.5 text-[13px]"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-[11px] text-danger">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-3">
          <Button variant="ghost" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="text-xs" disabled={!value.trim()}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
