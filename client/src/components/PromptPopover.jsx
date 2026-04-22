import { useState, useEffect, useRef } from 'react'
import { Button } from '../components/ui'

/**
 * Inline popover that replaces window.prompt().
 * Shows an input field with OK/Cancel buttons, auto-focuses.
 */
export default function PromptPopover({
  title,
  defaultValue = '',
  placeholder = '',
  onSubmit,
  onCancel,
  type = 'text',
  style,
}) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onCancel])

  const handleSubmit = () => {
    if (value.trim()) onSubmit(value.trim())
    else onCancel?.()
  }

  return (
    <>
      <div className="fixed inset-0 z-[9998] bg-black/40" onClick={onCancel} />
      <div className="absolute z-[9999] bg-card border border-border rounded-lg shadow-xl p-3 min-w-[240px]" ref={wrapperRef} style={style}>
        {title && <div className="text-xs font-semibold text-text-secondary mb-2">{title}</div>}
        <input
          ref={inputRef}
          type={type}
          className="w-full bg-surface-3 border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-[13px] focus:outline-none focus:border-accent"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="ghost" onClick={onCancel} className="text-xs">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="text-xs px-3 py-1"
          >
            OK
          </Button>
        </div>
      </div>
    </>
  )
}
