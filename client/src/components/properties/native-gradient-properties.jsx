import { useId } from 'react'
import { Button } from '../ui'
import NativeColorProperties from './native-color-properties'
import GradientInput, { controlClass, labelClass } from './native-gradient-input'
import NativeGradientGeometryProperties from './native-gradient-geometry-properties'
// pptx-text-document color schema: alpha fixed percentage, alphaMod positive
// percentage, alphaOff signed percentage. Preserve native units and ordering.
const alphaRanges = { alpha: [0, 100000], alphaMod: [0, 1000000], alphaOff: [-100000, 1000000] }

export default function NativeGradientProperties({
  gradient: paint,
  editState,
  disabled,
  onValue,
  onEdit,
}) {
  const gradient = editState?.gradient ?? paint
  const hintId = useId()
  const update = (next) => {
    if (!disabled) onValue(next)
  }
  const updateStop = (index, stop) =>
    update({ ...gradient, stops: gradient.stops.map((entry, i) => (i === index ? stop : entry)) })
  const editStops = (entries) => {
    if (!disabled) onEdit({ stops: { provider: editState.provider, entries } })
  }
  const editStop = (index, patch) =>
    editStops(editState.entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)))
  return (
    <section className="flex min-w-0 max-w-full flex-col gap-2" aria-label="Native gradient">
      <NativeGradientGeometryProperties
        gradient={gradient}
        sparse={!!editState}
        disabled={disabled}
        onEdit={onEdit}
        onValue={update}
        hintId={hintId}
      />
      <p
        id={hintId}
        className="break-words text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]"
      >
        Positions may coincide for hard transitions. Added stops copy the selected stop.
      </p>
      {gradient.stops.map((stop, index) => (
        <fieldset
          key={`${gradient.stops.length}:${index}`}
          className="flex min-w-0 flex-col gap-2 border border-border p-2"
        >
          <legend className={labelClass}>Stop {index + 1}</legend>
          <GradientInput
            label={`Gradient stop ${index + 1} position`}
            value={stop.pos}
            min={gradient.stops[index - 1]?.pos ?? 0}
            max={gradient.stops[index + 1]?.pos ?? 100000}
            disabled={disabled}
            hint="100000 native position units = 100%."
            onValue={(pos) =>
              editState ? editStop(index, { pos }) : updateStop(index, { ...stop, pos })
            }
          />
          <NativeColorProperties
            label={`Gradient stop ${index + 1}`}
            color={stop.color}
            disabled={disabled}
            onValue={(color) => {
              if (editState) {
                const { transforms: _transforms, ...base } = color
                editStop(index, { color: base })
              } else updateStop(index, { ...stop, color })
            }}
          />
          {(stop.color.transforms ?? []).map((transform, transformIndex) => {
            const range = alphaRanges[transform.kind]
            return range ? (
              <GradientInput
                key={transformIndex}
                label={`Gradient stop ${index + 1} ${transform.kind} transform ${transformIndex + 1}`}
                value={transform.value}
                min={range[0]}
                max={range[1]}
                disabled={disabled}
                hint="100000 native alpha units = 100%; transform order is retained."
                onValue={(value) => {
                  if (editState) {
                    const entry = editState.entries[index]
                    const transforms =
                      entry.transforms ??
                      (entry.from === undefined
                        ? stop.color.transforms.map((transform) => ({ ...transform }))
                        : editState.providerTransforms[entry.from].map((_, from) => ({ from })))
                    editStop(index, {
                      transforms: transforms.map((entry, i) =>
                        i === transformIndex ? { ...entry, value } : entry
                      ),
                    })
                  } else
                    updateStop(index, {
                      ...stop,
                      color: {
                        ...stop.color,
                        transforms: stop.color.transforms.map((entry, i) =>
                          i === transformIndex ? { ...entry, value } : entry
                        ),
                      },
                    })
                }}
              />
            ) : null
          })}
          <Button
            variant="secondary"
            className={controlClass}
            aria-label={`Add stop after ${index + 1}`}
            disabled={disabled || gradient.stops.length === 256}
            onClick={() => {
              if (disabled || gradient.stops.length === 256) return
              if (editState) {
                const entries = [...editState.entries]
                entries.splice(index + 1, 0, {
                  ...structuredClone(entries[index]),
                  key: crypto.randomUUID(),
                })
                editStops(entries)
                return
              }
              const stops = [...gradient.stops]
              stops.splice(index + 1, 0, structuredClone(stop))
              update({ ...gradient, stops })
            }}
          >
            Add stop
          </Button>
          <Button
            variant="secondary"
            className={controlClass}
            aria-label={`Remove stop ${index + 1}`}
            disabled={disabled || gradient.stops.length === 2}
            onClick={() => {
              if (disabled || gradient.stops.length === 2) return
              if (editState) {
                editStops(editState.entries.filter((_, i) => i !== index))
                return
              }
              update({ ...gradient, stops: gradient.stops.filter((_, i) => i !== index) })
            }}
          >
            Remove stop
          </Button>
        </fieldset>
      ))}
    </section>
  )
}
