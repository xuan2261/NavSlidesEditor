import { useId, useState } from 'react'
import { Button, Input, Select } from '../ui'
import geometryCore from 'revealjs-shared/src/pptx-geometry-document.js'
import NativeColorProperties from './native-color-properties'

const labelClass =
  'flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]'
const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'
const alphaRanges = { alpha: [0, 100000], alphaMod: [0, 1000000], alphaOff: [-100000, 1000000] }
const fieldLabels = {
  blurRad: 'blur',
  dist: 'distance',
  dir: 'direction',
  sx: 'scale X',
  sy: 'scale Y',
  kx: 'skew X',
  ky: 'skew Y',
}

function ShadowInput({ label, value, min, max, optional = false, disabled, onValue, hint }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const text = draft ?? (value === undefined ? '' : String(value))
  const validate = (raw) =>
    (optional && raw === '') ||
    (/^-?\d+$/.test(raw) &&
      Number.isSafeInteger(Number(raw)) &&
      Number(raw) >= min &&
      Number(raw) <= max)
  const valid = validate(text)
  return (
    <div className="min-w-0 max-w-full">
      <label className={labelClass}>
        {label}
        <Input
          aria-label={label}
          className={controlClass}
          inputMode="numeric"
          value={text}
          placeholder={optional ? 'Unspecified' : undefined}
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
          ? hint
          : `Enter a whole number from ${min} to ${max}${optional ? ', or leave blank' : ''}.`}
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

export default function NativeShadowProperties({ shadow, sourceColor, disabled, onValue }) {
  const update = (next) => {
    if (!disabled) onValue(next)
  }
  const attribute = (field, value) => {
    const next = { ...shadow, color: sourceColor ?? shadow.color }
    if (value === undefined) delete next[field]
    else next[field] = value
    update(next)
  }
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-2" aria-label="Native shadow">
      {Object.entries(geometryCore.OUTER_SHADOW_RANGES).map(([field, [min, max]]) => (
        <ShadowInput
          key={field}
          label={`Native shadow ${fieldLabels[field]}`}
          value={shadow[field]}
          min={min}
          max={max}
          optional
          disabled={disabled}
          hint="Raw native units; blank leaves the attribute unspecified."
          onValue={(value) => attribute(field, value)}
        />
      ))}
      {['algn', 'rotWithShape'].map((field) => {
        const label = `Native shadow ${field === 'algn' ? 'alignment' : 'rotates'}`
        const options = field === 'algn' ? geometryCore.OUTER_SHADOW_ALIGNMENTS : ['true', 'false']
        return (
          <label key={field} className={labelClass}>
            {label}
            <Select
              aria-label={label}
              className={controlClass}
              disabled={disabled}
              value={shadow[field] === undefined ? '' : String(shadow[field])}
              onChange={(event) => {
                if (disabled) return
                const raw = event.target.value
                attribute(field, raw === '' ? undefined : field === 'algn' ? raw : raw === 'true')
              }}
            >
              <option value="">Unspecified</option>
              {options.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </label>
        )
      })}
      <NativeColorProperties
        label="Native shadow"
        color={shadow.color}
        disabled={disabled}
        onValue={(color) => update({ ...shadow, color })}
      />
      {(shadow.color.transforms ?? []).map((transform, index) => {
        const range = alphaRanges[transform.kind]
        return range ? (
          <ShadowInput
            key={index}
            label={`Native shadow ${transform.kind} transform ${index + 1}`}
            value={transform.value}
            min={range[0]}
            max={range[1]}
            disabled={disabled}
            hint="100000 native alpha units = 100%; transform order is retained."
            onValue={(value) =>
              update({
                ...shadow,
                color: {
                  ...shadow.color,
                  transforms: shadow.color.transforms.map((entry, i) =>
                    i === index ? { ...entry, value } : entry
                  ),
                },
              })
            }
          />
        ) : null
      })}
      <Button
        variant="secondary"
        className={controlClass}
        aria-label="Remove native shadow"
        disabled={disabled}
        onClick={() => update(null)}
      >
        Remove shadow
      </Button>
    </section>
  )
}
