import { Button, Select } from '../ui'
import patternCore from 'revealjs-shared/src/pptx-geometry-pattern.js'
import NativeColorProperties from './native-color-properties'

const labelClass =
  'flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]'
const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'

export default function NativePatternProperties({ pattern, disabled, onValue }) {
  const update = (patch) => {
    if (!disabled) onValue(patch)
  }
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-2" aria-label="Native pattern">
      <label className={labelClass}>
        Native pattern preset
        <Select
          aria-label="Native pattern preset"
          className={controlClass}
          value={pattern.preset ?? ''}
          disabled={disabled}
          onChange={(event) => update({ preset: event.target.value || null })}
        >
          <option value="">Unspecified (native default)</option>
          {patternCore.GEOMETRY_PATTERN_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </Select>
      </label>
      {['foreground', 'background'].map((field) => (
        <fieldset key={field} className="flex min-w-0 flex-col gap-2 border border-border p-2">
          <legend className={labelClass}>Pattern {field}</legend>
          {pattern[field] ? (
            <>
              <NativeColorProperties
                label={`Pattern ${field}`}
                color={pattern[field]}
                disabled={disabled}
                onValue={(color) => update({ [field]: color })}
              />
              <Button
                variant="secondary"
                className={controlClass}
                disabled={disabled}
                onClick={() => update({ [field]: null })}
              >
                Remove {field} color
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              className={controlClass}
              disabled={disabled}
              onClick={() =>
                update({
                  [field]: { kind: 'srgb', value: field === 'foreground' ? '000000' : 'FFFFFF' },
                })
              }
            >
              Add {field} color
            </Button>
          )}
        </fieldset>
      ))}
    </section>
  )
}
