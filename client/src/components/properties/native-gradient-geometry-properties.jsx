import { Select } from '../ui'
import GradientInput, { controlClass, labelClass } from './native-gradient-input'

const center = { l: 50000, t: 50000, r: 50000, b: 50000 }
export default function NativeGradientGeometryProperties({
  gradient,
  sparse,
  disabled,
  onEdit,
  onValue,
  hintId,
}) {
  const change = (patch) => {
    if (disabled) return
    if (sparse) {
      onEdit(patch)
      return
    }
    const next = { ...gradient, ...patch }
    for (const key of ['fillToRect', 'tileRect'])
      if (Object.hasOwn(patch, key))
        next[key] = {
          ...(gradient[key] ?? (key === 'fillToRect' ? center : {})),
          ...patch[key],
        }
    onValue(next)
  }
  return (
    <>
      {gradient.kind === 'linear' ? (
        <>
          <GradientInput
            label="Native gradient angle"
            value={gradient.angle}
            min={0}
            max={21599999}
            disabled={disabled}
            hint="60000 native angle units = 1 degree."
            onValue={(angle) => change({ angle })}
          />
          <label className={labelClass}>
            Native gradient scaled
            <Select
              aria-label="Native gradient scaled"
              aria-describedby={hintId}
              className={controlClass}
              disabled={disabled}
              value={String(gradient.scaled)}
              onChange={(event) => change({ scaled: event.target.value === 'true' })}
            >
              <option value="true">Scaled</option>
              <option value="false">Unscaled</option>
            </Select>
          </label>
        </>
      ) : (
        <label className={labelClass}>
          Native gradient path
          <Select
            aria-label="Native gradient path"
            className={controlClass}
            disabled={disabled}
            value={gradient.path}
            onChange={(event) => change({ path: event.target.value })}
          >
            <option value="circle">Circle</option>
            <option value="rect">Rectangle</option>
            <option value="shape">Shape</option>
          </Select>
        </label>
      )}
      {[...(gradient.kind === 'path' ? [['fillToRect', 'focus']] : []), ['tileRect', 'tile']].map(
        ([field, label]) => {
          const rectangle = gradient[field] ?? (field === 'fillToRect' ? center : {})
          return (
            <fieldset key={field} className="min-w-0 border border-border p-2">
              <legend className={labelClass}>Gradient {label} rectangle</legend>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                {[
                  ['l', 'left'],
                  ['t', 'top'],
                  ['r', 'right'],
                  ['b', 'bottom'],
                ].map(([edge, name]) => (
                  <GradientInput
                    key={edge}
                    label={`Gradient ${label} ${name}`}
                    value={rectangle[edge] ?? 0}
                    min={-2147483648}
                    max={2147483647}
                    disabled={disabled}
                    hint="100000 native units = 100% of the brush extent."
                    onValue={(value) => change({ [field]: { [edge]: value } })}
                  />
                ))}
              </div>
            </fieldset>
          )
        }
      )}
    </>
  )
}
