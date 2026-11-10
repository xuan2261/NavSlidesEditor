import { useId, useState } from 'react'
import { Button, Input } from '../ui'
import geometryCore from 'revealjs-shared/src/pptx-geometry-document.js'
import NativeColorProperties from './native-color-properties'

const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'
const fieldLabels = {
  blurRad: 'blur (EMU)',
  dist: 'distance (EMU)',
  dir: 'direction (1/60000 deg)',
}

function InnerShadowInput({ field, value, disabled, onValue }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const [min, max] = geometryCore.INNER_SHADOW_RANGES[field]
  const text = draft ?? (value === undefined ? '' : String(value))
  const validate = (raw) =>
    raw === '' ||
    (/^\d+$/.test(raw) &&
      Number.isSafeInteger(Number(raw)) &&
      Number(raw) >= min &&
      Number(raw) <= max)
  const valid = validate(text)
  const label = `Native inner shadow ${fieldLabels[field]}`
  return (
    <div className="min-w-0 max-w-full">
      <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
        {label}
        <Input
          aria-label={label}
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
            if (validate(raw)) onValue(raw === '' ? undefined : Number(raw))
          }}
        />
      </label>
      <p
        id={hintId}
        role={valid ? undefined : 'alert'}
        className="break-words text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]"
      >
        {valid
          ? `${field === 'dir' ? '60000 = 1 degree' : '9525 EMU = 1 slide pixel'}; blank leaves the attribute unspecified.`
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
  )
}

export default function NativeInnerShadowProperties({
  shadow,
  sourceColor,
  disabled,
  onValue,
  onSwitchOuter,
}) {
  const update = (next) => {
    if (!disabled) onValue(next)
  }
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-2" aria-label="Native inner shadow">
      {Object.keys(geometryCore.INNER_SHADOW_RANGES).map((field) => (
        <InnerShadowInput
          key={field}
          field={field}
          value={shadow[field]}
          disabled={disabled}
          onValue={(value) => {
            const next = { ...shadow, color: sourceColor ?? shadow.color }
            if (value === undefined) delete next[field]
            else next[field] = value
            update(next)
          }}
        />
      ))}
      <NativeColorProperties
        label="Native inner shadow"
        color={shadow.color}
        disabled={disabled}
        onValue={(color) => update({ ...shadow, color })}
      />
      <Button
        variant="secondary"
        className={controlClass}
        aria-label="Switch to native outer shadow"
        disabled={disabled}
        onClick={() => {
          if (!disabled)
            onSwitchOuter({ ...shadow, kind: 'outerShdw', color: sourceColor ?? shadow.color })
        }}
      >
        Switch to outer shadow
      </Button>
      <Button
        variant="secondary"
        className={controlClass}
        aria-label="Remove native inner shadow"
        disabled={disabled}
        onClick={() => update(null)}
      >
        Remove inner shadow
      </Button>
    </section>
  )
}
