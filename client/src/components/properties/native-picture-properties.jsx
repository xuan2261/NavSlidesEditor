import { useState } from 'react'
import pictureDocument from 'revealjs-shared/src/pptx-picture-document.js'
import replacementContract from 'revealjs-shared/src/pptx-picture-replacement.js'
import capabilities from 'revealjs-shared/src/pptx-projection-capabilities.js'
import NativePictureReplacementControl from './native-picture-replacement-control'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

const controlClass =
  'w-full min-h-[36px] [@media(pointer:coarse)]:min-h-[44px] min-w-0 border border-border bg-card px-2 text-sm text-text-primary'
const nativePercent = (text) => {
  if (!text.trim()) return null
  const raw = Number(text) * 1000
  if (!Number.isFinite(raw) || Math.abs(raw - Math.round(raw)) > 0.000001)
    throw new TypeError('Use at most three decimal places for a native percentage')
  return Math.round(raw)
}
export default function NativePictureProperties({ element, document, slideLocked, onUpdate }) {
  const [error, setError] = useState(null)
  const instance = semanticInstance(document, element.pptxInstanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  const picture = pictureDocument.materializePicture(definition, instance)
  const replacement = replacementContract.occurrencePictureReplacement(definition, instance)
  const blocked =
    element.locked ||
    slideLocked ||
    !capabilities
      .getProjectionCapabilities(document, instance.id)
      .operations.includes('picture.edit')
  const submit = async (createCommand) => {
    if (blocked) return
    try {
      await onUpdate({
        pptxProjectionOperation: {
          type: 'picture.edit',
          instanceId: instance.id,
          componentId: picture.componentId,
          command: createCommand(),
        },
      })
      setError(null)
    } catch (rejected) {
      setError(rejected.message)
    }
  }
  const alpha = (stages) => ({ type: 'alpha', stages })
  return (
    <fieldset disabled={blocked} className="min-w-0 space-y-3" aria-label="Native picture">
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <NativePictureReplacementControl document={document} instanceId={instance.id}
        blocked={blocked} replacement={replacement} submit={submit}
        setError={setError} controlClass={controlClass} />
      <p className="text-xs text-text-muted">
        Crop percentages retain the source frame. Negative values extend beyond the image.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {[
          ['l', 'left'],
          ['t', 'top'],
          ['r', 'right'],
          ['b', 'bottom'],
        ].map(([edge, label]) => (
          <label key={edge} className="text-xs">
            {label[0].toUpperCase() + label.slice(1)} crop (%)
            <input
              className={controlClass}
              type="number"
              step="0.001"
              min="-2147483.648"
              max="2147483.647"
              aria-label={`Picture crop ${label} (%)`}
              placeholder="0 (omitted)"
              value={picture.srcRect?.[edge] === undefined ? '' : picture.srcRect[edge] / 1000}
              onChange={(event) =>
                submit(() => ({
                  type: 'crop',
                  edge,
                  value: nativePercent(event.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          aria-label="Invert picture colors"
          checked={(picture.filters?.length ?? 0) % 2 === 1}
          onChange={(event) => submit(() => ({
            type: 'filters', stages: event.target.checked ? [{ kind: 'inv' }] : [],
          }))}
        />
        Invert picture colors (outline unchanged)
      </label>
      <p className="text-xs text-text-muted">
        Alpha stages apply in order to image content, not its outline. Values above 100% amplify
        alpha.
      </p>
      {picture.alpha.map((stage, index) => (
        <div key={index} className="space-y-1 border border-border p-2">
          <label className="text-xs">
            Alpha stage {index + 1} (%)
            <input
              className={controlClass}
              type="number"
              min="0"
              max="2147483.647"
              step="0.001"
              aria-label={`Picture alpha stage ${index + 1} (%)`}
              placeholder="100 (omitted)"
              value={stage.amt === undefined ? '' : stage.amt / 1000}
              onChange={(event) =>
                submit(() => {
                  const amount = nativePercent(event.target.value)
                  return alpha(
                    picture.alpha.map((entry, i) =>
                      i === index
                        ? { kind: 'alphaModFix', ...(amount === null ? {} : { amt: amount }) }
                        : entry
                    )
                  )
                })
              }
            />
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              className="[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]"
              disabled={index === 0}
              aria-label={`Move alpha stage ${index + 1} up`}
              onClick={() =>
                submit(() => {
                  const stages = [...picture.alpha]
                  ;[stages[index - 1], stages[index]] = [stages[index], stages[index - 1]]
                  return alpha(stages)
                })
              }
            >
              Move up
            </button>
            <button
              type="button"
              className="[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]"
              disabled={index === picture.alpha.length - 1}
              aria-label={`Move alpha stage ${index + 1} down`}
              onClick={() =>
                submit(() => {
                  const stages = [...picture.alpha]
                  ;[stages[index + 1], stages[index]] = [stages[index], stages[index + 1]]
                  return alpha(stages)
                })
              }
            >
              Move down
            </button>
            <button
              type="button"
              className="[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px]"
              aria-label={`Remove alpha stage ${index + 1}`}
              onClick={() => submit(() => alpha(picture.alpha.filter((_, i) => i !== index)))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={picture.alpha.length >= 64}
        className={controlClass}
        onClick={() => submit(() => alpha([...picture.alpha, { kind: 'alphaModFix' }]))}
      >
        Add alpha stage
      </button>
      <button
        type="button"
        className={controlClass}
        onClick={() => submit(() => ({ type: 'reset' }))}
      >
        Reset picture crop and alpha
      </button>
    </fieldset>
  )
}
