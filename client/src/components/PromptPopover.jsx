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
      <div className="popover-overlay" onClick={onCancel} />
      <div className="prompt-popover" ref={wrapperRef} style={style}>
        {title && <div className="prompt-popover-title">{title}</div>}
        <input
          ref={inputRef}
          type={type}
          className="select-sm"
          style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        <div className="prompt-popover-actions">
          <Button variant="ghost" onClick={onCancel} style={{ fontSize: 12 }}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            OK
          </Button>
        </div>
      </div>
    </>
  )
}
