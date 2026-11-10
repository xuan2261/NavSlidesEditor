import { useEffect, useState } from 'react'
import { Input, Select } from '../ui'

export const nativeTextControlClass = 'ui-coarse-target w-full min-w-0 rounded-md border border-border bg-card p-2 text-sm text-text-primary'

// Removing one authored value restores inheritance, never a materialized default.
export function withTextValue(record, key, value) {
  const next = { ...record }
  if (value === undefined) delete next[key]
  else next[key] = value
  return next
}
export function withTextProperties(node, field, key, value) {
  const properties = withTextValue(node[field], key, value)
  return withTextValue(node, field, Object.keys(properties).length ? properties : undefined)
}

export function NativeTextChoice({ label, value, options, onValue }) {
  const entries = options.map((option) => Array.isArray(option) ? option : [option, option])
  return <label className="min-w-0 text-xs text-text-secondary">{label}
    <Select aria-label={label} className={nativeTextControlClass} value={value ?? ''}
      onChange={(event) => onValue(event.target.value === '' ? undefined : event.target.value)}>
      <option value="">Inherited (not authored)</option>
      {value !== undefined && !entries.some(([key]) => key === value) && (
        <option value={value}>{value} (retained)</option>
      )}
      {entries.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
    </Select>
  </label>
}

export function NativeTextValue({ label, value, parse, hint, required = false, onValue }) {
  const [draft, setDraft] = useState(null)
  useEffect(() => setDraft(null), [value])
  const raw = draft ?? value ?? ''
  let valid = true
  try { if (raw !== '') parse(raw) } catch { valid = false }
  return <label className="min-w-0 text-xs text-text-secondary">{label}
    <Input aria-label={label} className={nativeTextControlClass} value={raw}
      placeholder="Inherited (not authored)" aria-invalid={!valid} required={required}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        let next
        try {
          next = text === '' ? undefined : parse(text)
          event.target.setCustomValidity('')
        } catch {
          event.target.setCustomValidity(hint)
          return
        }
        onValue(next)
      }} />
    {!valid && <span role="alert" className="block break-words">{hint}</span>}
  </label>
}

export function NativeTextNumber({ label, value, min = -2147483648, max = 2147483647, integer = true, required = false, onValue }) {
  return <NativeTextValue label={label} value={value} onValue={onValue} required={required}
    hint={`Enter ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}, or clear to inherit.`}
    parse={(raw) => {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) throw new TypeError('Invalid number')
      const number = Number(raw)
      if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isSafeInteger(number)))
        throw new TypeError('Number outside native text range')
      return number
    }} />
}
