import { useState } from 'react'
import { Button } from '../ui'
import geometryStyles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import capabilities from 'revealjs-shared/src/pptx-projection-capabilities.js'
import geometryColors from 'revealjs-shared/src/pptx-geometry-color.js'
import NativeColorProperties from './native-color-properties'
import NativeGradientProperties from './native-gradient-properties'
import NativePatternProperties from './native-pattern-properties'
import NativeBlipProperties from './native-blip-properties'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

const controlClass =
  'min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]'

export default function NativeGroupFillProperties({ document, frame, disabled, onUpdate }) {
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState(null)
  const owner = semanticInstance(document, frame.ownerInstanceId)
  const definition = semanticDefinition(document, owner?.definitionId)
  const resolved = geometryStyles.resolveGeometryStyle(document, owner.id)
  const fill = resolved.style.fill
  const blocked =
    disabled ||
    !capabilities
      .getProjectionCapabilities(document, owner.id)
      .operations.includes(capabilities.GROUP_FILL_EDIT)
  const submit = (command) => {
    if (blocked) return
    try {
      onUpdate({
        pptxProjectionOperation: {
          type: capabilities.GROUP_FILL_EDIT,
          instanceId: owner.id,
          componentId: frame.componentId,
          command,
        },
      })
      setError(null)
    } catch (rejected) {
      if (!(rejected instanceof Error)) throw rejected
      setError(rejected.message)
    }
  }
  return (
    <section
      className="flex min-w-0 max-w-full flex-col gap-2 border border-border p-2"
      aria-label="Inherited group fill"
    >
      <p className="break-words text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
        Owner group {definition.source.nativeId}: {owner.id}. Owner edits affect its inheriting
        descendants.
      </p>
      <Button
        variant="secondary"
        className={controlClass}
        disabled={blocked}
        aria-expanded={opened}
        onClick={() => {
          if (!blocked) setOpened(!opened)
        }}
      >
        {opened ? 'Close owner group' : 'Edit owner group'}
      </Button>
      {opened && (
        <>
          {error && (
            <div
              role="alert"
              className="sticky top-0 z-10 break-words bg-secondary text-sm text-text-primary"
            >
              {error}
            </div>
          )}
          {geometryColors.GEOMETRY_COLOR_KINDS.includes(fill?.color?.kind) && (
            <NativeColorProperties
              label="Owner group fill"
              color={fill.color}
              disabled={blocked}
              onValue={(color) => submit({ type: 'fill-paint', color })}
            />
          )}
          {fill?.gradient && (
            <NativeGradientProperties
              gradient={fill.gradient}
              editState={resolved.gradientEdit}
              onEdit={(patch) => submit({ type: 'fill-gradient-patch', patch })}
              disabled={blocked}
              onValue={(gradient) => submit({ type: 'fill-gradient', gradient })}
            />
          )}
          {fill?.pattern && (
            <NativePatternProperties
              pattern={fill.pattern}
              disabled={blocked}
              onValue={(pattern) => submit({ type: 'fill-pattern', pattern })}
            />
          )}
          {fill?.blip && (
            <NativeBlipProperties
              blip={fill.blip}
              disabled={blocked}
              onValue={(blip) => submit({ type: 'fill-blip', blip })}
            />
          )}
          <Button
            variant="secondary"
            className={controlClass}
            disabled={blocked}
            onClick={() => submit({ type: 'fill-paint', color: { kind: 'none' } })}
          >
            No group fill
          </Button>
          <Button
            variant="secondary"
            className={controlClass}
            disabled={blocked}
            onClick={() => submit({ type: 'reset' })}
          >
            Reset group fill
          </Button>
        </>
      )}
    </section>
  )
}
