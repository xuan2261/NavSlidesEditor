import React, { useEffect, useId, useState } from 'react'
import { resolveUrlEntry } from '../../utils/url-safety'
import { FIELD_CLASS, TextField } from './game-authoring-fields'

export default function AuthoringMedia({ label, value, onChange }) {
  const id = useId()
  const [draft, setDraft] = useState(value?.src || '')
  const [error, setError] = useState('')
  useEffect(() => {
    setDraft(value?.src || '')
    setError('')
  }, [value?.src])
  const update = (event) => {
    const text = event.target.value
    const safe = resolveUrlEntry(text, 'image')
    setDraft(text)
    setError(safe.error)
    if (!text.trim()) onChange(undefined)
    else if (safe.value) onChange({ src: safe.value, alt: value?.alt || '' })
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-text-muted">
        {label} image URL
        <input
          id={id}
          aria-label={`${label} image URL`}
          className={FIELD_CLASS}
          value={draft}
          onChange={update}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </label>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <TextField
        label={`${label} image alt text`}
        value={value?.alt || ''}
        disabled={!value?.src}
        onChange={(alt) => onChange({ ...value, alt })}
      />
    </div>
  )
}
