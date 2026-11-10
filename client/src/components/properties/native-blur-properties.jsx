import { useId, useState } from 'react'
import { Button, Input, Select } from '../ui'
import geometryCore from 'revealjs-shared/src/pptx-geometry-document.js'

const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'

export default function NativeBlurProperties({ blur, disabled, onValue }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const [min, max] = geometryCore.BLUR_RANGES.rad
  const text = draft ?? (blur.rad === undefined ? '' : String(blur.rad))
  const validate = (raw) =>
    raw === '' ||
    (/^\d+$/.test(raw) &&
      Number.isSafeInteger(Number(raw)) &&
      Number(raw) >= min &&
      Number(raw) <= max)
  const valid = validate(text)
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-2" aria-label="Native blur">
      <div className="min-w-0 max-w-full">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
          Native blur radius (EMU)
          <Input
            aria-label="Native blur radius (EMU)"
            className={controlClass}
            inputMode="numeric"
            value={text}
            placeholder="Unspecified"
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
              if (validate(raw)) {
                const next = { ...blur }
                if (raw === '') delete next.rad
                else next.rad = Number(raw)
                onValue(next)
              }
            }}
          />
        </label>
        <p
          id={hintId}
          role={valid ? undefined : 'alert'}
          className="break-words text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]"
        >
          {valid
            ? '9525 EMU = 1 slide pixel; blank leaves the radius unspecified.'
            : `Enter a whole number from ${min} to ${max}, or leave blank.`}
        </p>
        {!valid && (
          <Button
            variant="secondary"
            className={controlClass}
            disabled={disabled}
            onClick={() => {
              if (!disabled) setDraft(null)
            }}
          >
            Discard invalid draft
          </Button>
        )}
      </div>
      <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
        Native blur grow
        <Select
          aria-label="Native blur grow"
          className={controlClass}
          disabled={disabled}
          value={blur.grow === undefined ? '' : String(blur.grow)}
          onChange={(event) => {
            if (disabled) return
            const next = { ...blur }
            if (event.target.value === '') delete next.grow
            else next.grow = event.target.value === 'true'
            onValue(next)
          }}
        >
          <option value="">Unspecified</option>
          <option value="false">False</option>
          <option value="true">True</option>
        </Select>
      </label>
      <Button
        variant="secondary"
        className={controlClass}
        aria-label="Remove native blur"
        disabled={disabled}
        onClick={() => {
          if (!disabled) onValue(null)
        }}
      >
        Remove blur
      </Button>
    </section>
  )
}
