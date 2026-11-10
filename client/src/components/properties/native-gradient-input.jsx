import { useId, useState } from 'react'
import { Button, Input } from '../ui'

export const labelClass =
  'flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]'
export const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'

export default function GradientInput({ label, value, min, max, disabled, onValue, hint }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const text = draft ?? String(value)
  const validate = (raw) =>
    /^-?\d+$/.test(raw) && Number.isInteger(Number(raw)) && Number(raw) >= min && Number(raw) <= max
  const valid = validate(text)
  return (
    <div className="min-w-0">
      <label className={labelClass}>
        {label}
        <Input
          aria-label={label}
          className={controlClass}
          inputMode="numeric"
          value={text}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hintId}
          onBlur={() => {
            if (valid) setDraft(null)
          }}
          onChange={(event) => {
            if (disabled) return
            const raw = event.target.value
            setDraft(raw)
            if (validate(raw)) onValue(Number(raw))
          }}
        />
      </label>
      <p
        id={hintId}
        role={valid ? undefined : 'alert'}
        className="break-words text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]"
      >
        {valid ? hint : `Enter a whole number from ${min} to ${max}.`}
      </p>
      {!valid && (
        <Button
          variant="secondary"
          className={controlClass}
          disabled={disabled}
          onClick={() => setDraft(null)}
        >
          Discard invalid draft
        </Button>
      )}
    </div>
  )
}
