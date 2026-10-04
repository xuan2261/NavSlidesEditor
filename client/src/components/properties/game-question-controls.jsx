import { createContext, useContext, useId } from 'react'
import { resolveUrlEntry } from '../../utils/url-safety'

export const QuestionErrors = createContext([])
export const inputClass =
  'w-full min-h-8 rounded-md border border-border bg-card px-2 py-1 text-xs text-text-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25'
export const buttonClass =
  'min-h-8 rounded border border-border px-2 py-1 text-xs text-text-primary hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-focus/25 disabled:opacity-40'

function useFieldErrors(path = []) {
  const errors = useContext(QuestionErrors)
  const id = useId()
  const matching = errors.filter((error) => {
    const parts = error.path || []
    return (
      parts.length > 0 &&
      path.length > 0 &&
      parts
        .slice(0, Math.min(parts.length, path.length))
        .every((part, index) => String(part) === String(path[index]))
    )
  })
  return {
    id,
    matching,
    attributes: matching.length ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {},
  }
}

export function Field({ label, path, children }) {
  const { id, matching, attributes } = useFieldErrors(path)
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs text-text-muted">
        {label}
      </label>
      {children({ id, 'aria-label': label, ...attributes })}
      {matching.length > 0 && (
        <p id={`${id}-error`} className="text-xs text-red-500">
          {matching.map((error) => `${error.path.join('.')}: ${error.message}`).join('; ')}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, value, onChange, path, multiline = false, inputRef, ...props }) {
  const Control = multiline ? 'textarea' : 'input'
  return (
    <Field label={label} path={path}>
      {(attributes) => (
        <Control
          {...attributes}
          {...props}
          ref={inputRef}
          className={inputClass}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  )
}

export function NumericField({ label, value, onChange, path, nullable = false, ...props }) {
  return (
    <Field label={label} path={path}>
      {(attributes) => (
        <input
          {...attributes}
          {...props}
          className={inputClass}
          type="number"
          step="any"
          value={Number.isNaN(value) ? '' : (value ?? '')}
          onChange={(event) =>
            onChange(
              event.target.value === '' ? (nullable ? null : NaN) : event.target.valueAsNumber
            )
          }
        />
      )}
    </Field>
  )
}

export function SelectField({ label, value, onChange, path, children }) {
  return (
    <Field label={label} path={path}>
      {(attributes) => (
        <select
          {...attributes}
          className={inputClass}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
      )}
    </Field>
  )
}

export function CheckField({ label, checked, onChange, path, type = 'checkbox', name }) {
  return (
    <Field label={label} path={path}>
      {(attributes) => (
        <input
          {...attributes}
          type={type}
          name={name}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-accent"
        />
      )}
    </Field>
  )
}

export function MediaFields({ media, onChange, label, path }) {
  const safe = media?.src ? resolveUrlEntry(media.src, 'image') : { error: '' }
  const update = (patch) => onChange({ src: '', alt: '', ...media, ...patch })
  return (
    <div className="space-y-1">
      <TextField
        label={`${label} image URL`}
        path={[...path, 'src']}
        value={media?.src}
        onChange={(src) => {
          const resolved = resolveUrlEntry(src, 'image')
          update({ src: resolved.error ? src : resolved.value })
        }}
        placeholder="https://… or /uploads/…"
      />
      {safe.error && <p className="text-xs text-red-500">{safe.error}</p>}
      <TextField
        label={`${label} image alt text`}
        path={[...path, 'alt']}
        value={media?.alt}
        onChange={(alt) => update({ alt })}
      />
      {media && (
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange(undefined)}
          aria-label={`Remove ${label} image`}
        >
          Remove image
        </button>
      )}
    </div>
  )
}

export function moveItem(items, index, offset) {
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function RowActions({ label, index, count, onMove, onDelete, deleteVerb = 'Delete' }) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        className={buttonClass}
        disabled={index === 0}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(-1)}
      >
        Up
      </button>
      <button
        type="button"
        className={buttonClass}
        disabled={index === count - 1}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(1)}
      >
        Down
      </button>
      <button
        type="button"
        className={buttonClass}
        aria-label={`${deleteVerb} ${label}`}
        onClick={onDelete}
      >
        {deleteVerb}
      </button>
    </div>
  )
}

export function ItemSelect({ label, value, options, onChange, path }) {
  const missing = value && !options.some((option) => option.id === value)
  return (
    <SelectField label={label} value={value} onChange={onChange} path={path}>
      <option value="">Choose an item</option>
      {missing && <option value={value}>Missing item ({value}) — choose a replacement</option>}
      {options.map((option, index) => (
        <option key={option.id} value={option.id}>
          {option.text || `Item ${index + 1}`} ({index + 1})
        </option>
      ))}
    </SelectField>
  )
}
