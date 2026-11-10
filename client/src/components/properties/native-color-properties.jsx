import { useId, useState } from 'react'
import { Button, Input, Select } from '../ui'
import geometryColors from 'revealjs-shared/src/pptx-geometry-color.js'

const labelClass =
  'flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]'
const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'

function ColorInput({ label, value, min, max, rgb = false, discardOnBlur, disabled, onValue }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const text = draft ?? String(value)
  const validate = (raw) =>
    rgb
      ? /^[\da-f]{6}$/i.test(raw)
      : /^-?\d+$/.test(raw) &&
        Number.isSafeInteger(Number(raw)) &&
        Number(raw) >= min &&
        Number(raw) <= max
  const valid = validate(text)
  return (
    <div className="min-w-0 max-w-full">
      <label className={labelClass}>
        {label}
        <Input
          aria-label={label}
          className={controlClass}
          inputMode={rgb ? 'text' : 'numeric'}
          value={text}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={hintId}
          onBlur={() => {
            if (valid || discardOnBlur) setDraft(null)
          }}
          onChange={(event) => {
            if (disabled) return
            const raw = event.target.value
            setDraft(raw)
            if (validate(raw)) onValue(rgb ? raw : Number(raw))
          }}
        />
      </label>
      <p
        id={hintId}
        role={valid ? undefined : 'alert'}
        className="break-words text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]"
      >
        {valid
          ? 'Ordered native color transforms are retained.'
          : rgb
            ? 'Enter six hexadecimal digits.'
            : `Enter a whole number from ${min} to ${max}.`}
      </p>
      {!valid && !discardOnBlur && (
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

export default function NativeColorProperties({
  label,
  color,
  disabled,
  onValue,
  discardOnBlur = false,
}) {
  if (color.kind === 'preset') {
    return (
      <label className={labelClass}>
        {label} preset
        <Select
          aria-label={`${label} preset`}
          className={controlClass}
          disabled={disabled}
          value={color.value}
          onChange={(event) => {
            if (!disabled) onValue({ ...color, value: event.target.value })
          }}
        >
          {geometryColors.GEOMETRY_PRESET_COLOR_NAMES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      </label>
    )
  }
  if (color.kind === 'srgb')
    return (
      <ColorInput
        label={`${label} RGB`}
        value={color.value}
        rgb
        discardOnBlur={discardOnBlur}
        disabled={disabled}
        onValue={(value) => onValue({ ...color, value })}
      />
    )
  const fields =
    color.kind === 'scrgb'
      ? [
          ['r', 'red (1/1000%)'],
          ['g', 'green (1/1000%)'],
          ['b', 'blue (1/1000%)'],
        ]
      : [
          ['hue', 'hue (1/60000 deg)'],
          ['sat', 'saturation (1/1000%)'],
          ['lum', 'luminance (1/1000%)'],
        ]
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      {fields.map(([key, name]) => (
        <ColorInput
          key={key}
          label={`${label} ${name}`}
          value={color.value[key]}
          min={key === 'hue' ? 0 : -2147483648}
          max={key === 'hue' ? 21600000 : 2147483647}
          disabled={disabled}
          onValue={(value) => onValue({ ...color, value: { ...color.value, [key]: value } })}
        />
      ))}
    </div>
  )
}
