import { useId, useState } from 'react'
import { Button, Input, Select } from '../ui'
const labelClass =
  'flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]'
const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'
function ImageNumber({ label, value, min = -2147483648, max = 2147483647, disabled, onValue }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const text = draft ?? (value === undefined ? '' : String(value))
  const validate = (raw) =>
    raw === '' ||
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
          placeholder="Unspecified"
          disabled={disabled}
          aria-invalid={!valid}
          aria-describedby={hintId}
          onBlur={() => {
            if (valid) setDraft(null)
          }}
          onChange={(event) => {
            if (disabled) return
            const raw = event.target.value
            setDraft(raw)
            if (validate(raw)) onValue(raw === '' ? null : Number(raw))
          }}
        />
      </label>
      {!valid && (
        <>
          <p id={hintId} role="alert" className="break-words text-sm text-text-secondary">
            Enter a whole number from {min} to {max}, or clear the authored value.
          </p>
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
        </>
      )}
    </div>
  )
}
export default function NativeBlipProperties({ blip, disabled, onValue }) {
  const update = (patch) => {
    if (!disabled) onValue(patch)
  }
  const field = (object, key, value) => {
    const next = { ...object }
    if (value === null) delete next[key]
    else next[key] = value
    return next
  }
  const rectangle = (value, label, onRect) =>
    ['l', 't', 'r', 'b'].map((key) => (
      <ImageNumber
        key={key}
        label={`Native image ${label} ${{ l: 'left', t: 'top', r: 'right', b: 'bottom' }[key]} (1/1000%)`}
        value={value[key]}
        disabled={disabled}
        onValue={(entry) => onRect(field(value, key, entry))}
      />
    ))
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-2" aria-label="Native image fill">
      <ImageNumber
        label="Native image DPI"
        value={blip.dpi}
        min={0}
        max={4294967295}
        disabled={disabled}
        onValue={(dpi) => update({ dpi })}
      />
      <label className={labelClass}>
        Native image rotate with shape
        <Select
          aria-label="Native image rotate with shape"
          className={controlClass}
          disabled={disabled}
          value={blip.rotWithShape === undefined ? '' : String(blip.rotWithShape)}
          onChange={(event) =>
            update({
              rotWithShape: event.target.value === '' ? null : event.target.value === 'true',
            })
          }
        >
          <option value="">Unspecified</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      </label>
      <label className={labelClass}>
        Native image placement
        <Select
          aria-label="Native image placement"
          className={controlClass}
          disabled={disabled}
          value={blip.stretch ? 'stretch' : blip.tile ? 'tile' : ''}
          onChange={(event) =>
            update(
              event.target.value === 'stretch'
                ? { tile: null, stretch: {} }
                : event.target.value === 'tile'
                  ? { stretch: null, tile: {} }
                  : { tile: null, stretch: null }
            )
          }
        >
          <option value="">Unspecified (native default)</option>
          <option value="tile">Tile</option>
          <option value="stretch">Stretch</option>
        </Select>
      </label>
      <fieldset className="flex min-w-0 flex-col gap-2 border border-border p-2">
        <legend className={labelClass}>Source crop</legend>
        {blip.srcRect ? (
          <>
            {rectangle(blip.srcRect, 'crop', (srcRect) => update({ srcRect }))}
            <Button
              variant="secondary"
              className={controlClass}
              disabled={disabled}
              onClick={() => update({ srcRect: null })}
            >
              Remove source crop
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            className={controlClass}
            disabled={disabled}
            onClick={() => update({ srcRect: {} })}
          >
            Add source crop
          </Button>
        )}
      </fieldset>
      {blip.tile && (
        <fieldset className="flex min-w-0 flex-col gap-2 border border-border p-2">
          <legend className={labelClass}>Native tile</legend>
          {['tx', 'ty', 'sx', 'sy'].map((key) => (
            <ImageNumber
              key={key}
              label={`Native image tile ${key} (${key.startsWith('s') ? '1/1000%' : 'EMU'})`}
              value={blip.tile[key]}
              min={key.startsWith('s') ? 0 : -2147483648}
              disabled={disabled}
              onValue={(value) => update({ tile: field(blip.tile, key, value) })}
            />
          ))}
          {[
            ['algn', ['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br']],
            ['flip', ['none', 'x', 'y', 'xy']],
          ].map(([key, values]) => (
            <label key={key} className={labelClass}>
              Native image tile {key}
              <Select
                aria-label={`Native image tile ${key}`}
                className={controlClass}
                disabled={disabled}
                value={blip.tile[key] ?? ''}
                onChange={(event) =>
                  update({ tile: field(blip.tile, key, event.target.value || null) })
                }
              >
                <option value="">Unspecified</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </fieldset>
      )}
      {blip.stretch && (
        <fieldset className="flex min-w-0 flex-col gap-2 border border-border p-2">
          <legend className={labelClass}>Destination fill rectangle</legend>
          {blip.stretch.fillRect ? (
            <>
              {rectangle(blip.stretch.fillRect, 'fill rectangle', (fillRect) =>
                update({ stretch: { fillRect } })
              )}
              <Button
                variant="secondary"
                className={controlClass}
                disabled={disabled}
                onClick={() => update({ stretch: {} })}
              >
                Remove fill rectangle
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              className={controlClass}
              disabled={disabled}
              onClick={() => update({ stretch: { fillRect: {} } })}
            >
              Add fill rectangle
            </Button>
          )}
        </fieldset>
      )}
    </section>
  )
}
