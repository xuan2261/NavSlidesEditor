import { useId, useState } from 'react'
import { Button } from '../ui'

export default function NativeEffectProgramProperties({
  program,
  disabled,
  initiallyOpen,
  onValue,
}) {
  const id = useId()
  const [open, setOpen] = useState(initiallyOpen)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="min-w-0 max-w-full"
    >
      <summary className="min-h-[44px] cursor-pointer text-sm text-text-secondary">
        Effect program
      </summary>
      <label htmlFor={id} className="block text-sm text-text-secondary">
        Native effect program
      </label>
      <textarea
        id={id}
        aria-label="Native effect program"
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        disabled={disabled}
        spellCheck={false}
        rows={12}
        className="w-full min-w-0 max-w-full resize-y rounded border border-border bg-card px-2 py-1.5 font-mono text-xs text-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
        value={draft ?? JSON.stringify(program ?? null, null, 2)}
        onBlur={() => {
          if (!error) setDraft(null)
        }}
        onChange={(event) => {
          if (disabled) return
          const raw = event.target.value
          setDraft(raw)
          try {
            const rejection = onValue(JSON.parse(raw))
            setError(rejection ?? null)
          } catch (invalid) {
            if (!(invalid instanceof Error)) throw invalid
            setError(invalid.message)
          }
        }}
      />
      <p id={`${id}-help`} className="break-words text-xs text-text-muted">
        Canonical list or DAG JSON. Valid changes apply immediately; null clears effects. Symbolic
        colors and omitted fields retain their source meaning.
      </p>
      {error && (
        <>
          <p id={`${id}-error`} role="alert" className="break-words text-sm text-text-secondary">
            {error} The last valid program is unchanged.
          </p>
          <Button
            variant="secondary"
            disabled={disabled}
            className="min-h-[44px] max-w-full text-sm"
            onClick={() => {
              if (disabled) return
              setDraft(null)
              setError(null)
            }}
          >
            Discard effect program draft
          </Button>
        </>
      )}
    </details>
  )
}
