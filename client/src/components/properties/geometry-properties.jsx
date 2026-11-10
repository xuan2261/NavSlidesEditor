import { useId, useState } from 'react'
import { Button, Input, Select } from '../ui'
import { useEditorStore } from '../../stores/editor-store'
import geometryCore from 'revealjs-shared/src/pptx-geometry-document.js'
import projectionCapabilities from 'revealjs-shared/src/pptx-projection-capabilities.js'
import connectors from 'revealjs-shared/src/pptx-semantic-connectors.js'
import geometryStyles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import geometryRecords from 'revealjs-shared/src/pptx-geometry-style-records.js'
import ConnectorProperties from './connector-properties'
import NativeGradientProperties from './native-gradient-properties'
import NativePatternProperties from './native-pattern-properties'
import NativeBlipProperties from './native-blip-properties'
import NativeGroupFillProperties from './native-group-fill-properties'
import NativeShadowProperties from './native-shadow-properties'
import NativeInnerShadowProperties from './native-inner-shadow-properties'
import NativeGlowProperties from './native-glow-properties'
import NativeSoftEdgeProperties from './native-soft-edge-properties'
import NativeBlurProperties from './native-blur-properties'
import NativeEffectProgramProperties from './native-effect-program-properties'
import NativeColorProperties from './native-color-properties'
import geometryColors from 'revealjs-shared/src/pptx-geometry-color.js'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

const DASH_LABELS = {
  solid: 'Solid',
  dot: 'Dotted',
  dash: 'Dashed',
  dashDot: 'Dash and dot',
  lgDash: 'Long dash',
  lgDashDot: 'Long dash + dot',
  lgDashDotDot: 'Long dash + dots',
  sysDot: 'System dots',
  sysDash: 'System dash',
  sysDashDot: 'System dash + dot',
  sysDashDotDot: 'System dash + dots',
}

function GeometryNumberInput({ label, value, disabled, onValue }) {
  const [draft, setDraft] = useState(null)
  const text = draft ?? String(value)
  const valid = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(Number(text))
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
      {label}
      <Input
        aria-label={label}
        className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-invalid={!valid}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) && Number.isFinite(Number(raw)))
            onValue(Number(raw))
        }}
      />
    </label>
  )
}

function NativeMiterLimitInput({ join, disabled, onValue }) {
  const [draft, setDraft] = useState(null)
  const hintId = useId()
  const text = draft ?? (join.limit === undefined ? '' : String(join.limit))
  const valid = text === '' || (/^\d+$/.test(text) && Number(text) <= 2147483647)
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
      Native miter limit
      <Input
        aria-label="Native miter limit"
        className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
        inputMode="numeric"
        placeholder="Unspecified"
        value={text}
        disabled={disabled}
        aria-invalid={!valid}
        aria-describedby={hintId}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const raw = event.target.value
          setDraft(raw)
          if (raw === '' || (/^\d+$/.test(raw) && Number(raw) <= 2147483647))
            onValue({ kind: 'miter', ...(raw === '' ? {} : { limit: Number(raw) }) })
        }}
      />
      <span id={hintId} role={valid ? undefined : 'alert'} className="text-sm">
        {valid ? '100000 = 100%' : 'Enter a whole number from 0 to 2147483647.'}
      </span>
    </label>
  )
}

function NativeLineEndProperties({ side, value, disabled, onValue }) {
  const labels = {
    none: 'None',
    triangle: 'Triangle',
    stealth: 'Stealth',
    diamond: 'Diamond',
    oval: 'Oval',
    arrow: 'Open arrow',
  }
  return (
    <>
      <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
        Native {side.toLowerCase()} arrow
        <Select
          aria-label={`Native ${side.toLowerCase()} arrow`}
          className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
          disabled={disabled}
          value={value === undefined ? 'absent' : (value.type ?? '')}
          onChange={(event) => {
            const type = event.target.value
            if (type === 'absent') onValue(null)
            else {
              const next = { ...value }
              if (type === '') delete next.type
              else next.type = type
              onValue(next)
            }
          }}
        >
          <option value="absent">Unspecified</option>
          <option value="">Default type</option>
          {geometryCore.LINE_END_TYPES.map((type) => (
            <option key={type} value={type}>
              {labels[type]}
            </option>
          ))}
        </Select>
      </label>
      {value !== undefined &&
        ['w', 'len'].map((attribute) => {
          const label = `${side} arrow ${attribute === 'w' ? 'width' : 'length'}`
          return (
            <label
              key={attribute}
              className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]"
            >
              {label}
              <Select
                aria-label={label}
                className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
                disabled={disabled}
                value={value[attribute] ?? ''}
                onChange={(event) => {
                  const next = { ...value }
                  if (event.target.value === '') delete next[attribute]
                  else next[attribute] = event.target.value
                  onValue(next)
                }}
              >
                <option value="">Unspecified</option>
                <option value="sm">Small</option>
                <option value="med">Medium</option>
                <option value="lg">Large</option>
              </Select>
            </label>
          )
        })}
    </>
  )
}

export default function GeometryProperties({
  element,
  pptxSemantic,
  onUpdate,
  slideLocked,
  selectedElementIds,
}) {
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [selectedArc, setSelectedArc] = useState(null)
  const [operationError, setOperationError] = useState({
    instanceId: element.pptxInstanceId,
    message: null,
  })
  const pointEditingId = useEditorStore((state) => state.geometryPointEditingElementId)
  const setPointEditingId = useEditorStore((state) => state.setGeometryPointEditingElementId)
  const instance = semanticInstance(pptxSemantic, element.pptxInstanceId)
  if (operationError.instanceId !== element.pptxInstanceId)
    setOperationError({ instanceId: element.pptxInstanceId, message: null })
  const provider = instance ? geometryRecords.geometryProvider(pptxSemantic, instance) : undefined
  const baseline = provider?.geometry
  if (![1, 2].includes(baseline?.schemaVersion)) return null
  const linkedGeometry = [2, 3].includes(pptxSemantic.schemaVersion)
  const geometry =
    baseline.connector !== undefined
      ? connectors.deriveConnectorGeometry(pptxSemantic, instance.id)
      : geometryStyles.materializeGeometry(pptxSemantic, instance.id)
  const env = geometryCore.evaluateGeometryGuides(geometry)
  const resolve = (value) => (typeof value === 'number' ? value : (env[value] ?? Number(value)))
  const points = geometry.paths.flatMap((path) =>
    path.commands.flatMap((command) =>
      (command.points || []).map((entry) => ({
        ...entry,
        scale: {
          x: path.width === undefined ? 1 : geometry.width / path.width,
          y: path.height === undefined ? 1 : geometry.height / path.height,
        },
      }))
    )
  )
  const point = points.find((entry) => entry.componentId === selectedPoint) ?? points[0]
  const arcs = geometry.paths.flatMap((path) =>
    path.commands.flatMap((command, commandIndex) =>
      command.kind === 'arcTo'
        ? [
            {
              key: `${path.componentId}:${commandIndex}`,
              pathId: path.componentId,
              commandIndex,
              command,
            },
          ]
        : []
    )
  )
  const arc = arcs.find((entry) => entry.key === selectedArc) ?? arcs[0]
  const endpoints =
    geometry.connector !== undefined ? connectors.connectorEndpointLocators(geometry) : null
  const attachedPoint =
    geometry.connector !== undefined &&
    ['start', 'end'].some(
      (end) =>
        instance.connectorBindings[end] && endpoints?.[end].componentId === point?.componentId
    )
  const editable =
    !element.locked &&
    !slideLocked &&
    (selectedElementIds || [element.id]).length === 1 &&
    projectionCapabilities
      .getProjectionCapabilities(pptxSemantic, instance.id)
      .operations.includes(projectionCapabilities.GEOMETRY_EDIT)
  const submit = (command, reportError = true) => {
    try {
      onUpdate({
        pptxProjectionOperation: {
          type: projectionCapabilities.GEOMETRY_EDIT,
          instanceId: instance.id,
          componentId: baseline.componentId,
          command,
        },
      })
      setOperationError({ instanceId: instance.id, message: null })
    } catch (error) {
      if (!(error instanceof Error)) throw error
      if (reportError) setOperationError({ instanceId: instance.id, message: error.message })
      return error.message
    }
  }
  const nativeStroke = geometryCore.geometryStrokePaint(geometry)
  const groupFillFrame =
    linkedGeometry
      ? geometryStyles.geometryFillFrame(pptxSemantic, instance.id)
      : undefined
  const nativeShadow = geometryCore.geometryOuterShadow(geometry)
  const nativeInnerShadow = geometryCore.geometryInnerShadow(geometry)
  const nativeGlow = geometryCore.geometryGlow(geometry)
  const nativeSoftEdge = geometryCore.geometrySoftEdge(geometry)
  const nativeBlur = geometryCore.geometryBlur(geometry)
  const authoredProgram =
    linkedGeometry
      ? geometryStyles.resolveGeometryStyle(pptxSemantic, instance.id).properties.effects.authored
      : geometry.style?.effects
  const authoredEffect = authoredProgram?.effects?.[0]
  const complexProgram = Boolean(
    geometry.style?.effects &&
    !(
      geometry.style.effects.kind === 'list' &&
      (geometry.style.effects.effects.length === 0 ||
        nativeShadow ||
        nativeInnerShadow ||
        nativeGlow ||
        nativeSoftEdge ||
        nativeBlur)
    )
  )
  const sourceDash = baseline.style?.stroke?.dash
  const currentDash = geometry.style?.stroke?.dash
  return (
    <div key={instance.id} className="mb-3 flex flex-col gap-2">
      <div className="text-xs text-text-secondary">
        Native geometry{geometry.preset ? `: ${geometry.preset}` : ''}
      </div>
      <div className="text-[11px] text-text-muted">
        Points use the authored path coordinate grid. Adjustments retain native formula units.
        Collapsed axes use shape-local displacement units.
      </div>
      {operationError.instanceId === instance.id && operationError.message && (
        <div
          role="alert"
          className="sticky top-0 z-10 break-words bg-secondary text-sm text-text-primary"
        >
          {operationError.message}
        </div>
      )}
      {linkedGeometry && (
        <>
          {['width', 'height'].map((axis) => (
            <GeometryNumberInput
              key={`${instance.id}:extent:${axis}`}
              label={`Native ${axis} (EMU)`}
              value={geometry[axis]}
              disabled={!editable}
              onValue={(value) => submit({ type: 'extent', [axis]: value })}
            />
          ))}
        </>
      )}
      {groupFillFrame && (
        <NativeGroupFillProperties
          key={`owner-${instance.id}-${groupFillFrame.ownerInstanceId}`}
          document={pptxSemantic}
          frame={groupFillFrame}
          disabled={!editable}
          onUpdate={onUpdate}
        />
      )}
      {geometry.style?.fill?.gradient && (
        <NativeGradientProperties
          key={instance.id}
          gradient={geometry.style.fill.gradient}
          editState={
            linkedGeometry
              ? geometryStyles.resolveGeometryStyle(pptxSemantic, instance.id).gradientEdit
              : undefined
          }
          onEdit={(patch) => submit({ type: 'fill-gradient-patch', patch })}
          disabled={!editable}
          onValue={(gradient) => submit({ type: 'fill-gradient', gradient })}
        />
      )}
      {geometry.style?.fill?.pattern && (
        <NativePatternProperties
          key={`pattern-${instance.id}`}
          pattern={geometry.style.fill.pattern}
          disabled={!editable}
          onValue={(pattern) => submit({ type: 'fill-pattern', pattern })}
        />
      )}
      {geometry.style?.fill?.blip && (
        <NativeBlipProperties
          key={`blip-${instance.id}`}
          blip={geometry.style.fill.blip}
          disabled={!editable}
          onValue={(blip) => submit({ type: 'fill-blip', blip })}
        />
      )}
      {nativeShadow && (
        <NativeShadowProperties
          key={`shadow-${instance.id}`}
          shadow={nativeShadow}
          sourceColor={authoredEffect?.color}
          disabled={!editable}
          onValue={(shadow) => submit({ type: 'outer-shadow', shadow })}
        />
      )}
      {nativeInnerShadow && (
        <NativeInnerShadowProperties
          key={`inner-shadow-${instance.id}`}
          shadow={nativeInnerShadow}
          sourceColor={authoredEffect?.color}
          disabled={!editable}
          onValue={(shadow) => submit({ type: 'inner-shadow', shadow })}
          onSwitchOuter={(shadow) => submit({ type: 'outer-shadow', shadow })}
        />
      )}
      {nativeGlow && (
        <NativeGlowProperties
          key={`glow-${instance.id}`}
          glow={nativeGlow}
          sourceColor={authoredEffect?.color}
          disabled={!editable}
          onValue={(glow) => submit({ type: 'glow', glow })}
        />
      )}
      {nativeSoftEdge && (
        <NativeSoftEdgeProperties
          key={JSON.stringify([
            instance.id,
            instance.definitionId,
            instance.sourceBinding,
            semanticDefinition(pptxSemantic, instance.definitionId)?.source,
            provider.definition.source,
          ])}
          softEdge={nativeSoftEdge}
          disabled={!editable}
          onValue={(softEdge) => submit({ type: 'soft-edge', softEdge })}
        />
      )}
      {nativeBlur && (
        <NativeBlurProperties
          key={JSON.stringify([
            instance.id,
            instance.definitionId,
            instance.sourceBinding,
            semanticDefinition(pptxSemantic, instance.definitionId)?.source,
            provider.definition.source,
          ])}
          blur={nativeBlur}
          disabled={!editable}
          onValue={(blur) => submit({ type: 'blur', blur })}
        />
      )}
      <NativeEffectProgramProperties
        key={JSON.stringify([
          'effect-program',
          instance.id,
          instance.definitionId,
          instance.sourceBinding,
          semanticDefinition(pptxSemantic, instance.definitionId)?.source,
          provider.definition.source,
        ])}
        program={authoredProgram}
        initiallyOpen={complexProgram}
        disabled={!editable}
        onValue={(effects) => submit({ type: 'effects', effects }, false)}
      />
      {!complexProgram && !nativeBlur && !Array.isArray(geometry.style?.effects) && (
        <Button
          variant="secondary"
          className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
          aria-label={
            nativeShadow || nativeInnerShadow || nativeGlow || nativeSoftEdge
              ? 'Switch to native blur'
              : 'Add native blur'
          }
          disabled={!editable}
          onClick={() => {
            if (!editable) return
            const previous = nativeGlow ?? nativeSoftEdge ?? nativeShadow ?? nativeInnerShadow
            const radius = nativeGlow || nativeSoftEdge ? previous.rad : previous?.blurRad
            submit({
              type: 'blur',
              blur: { kind: 'blur', ...(radius === undefined ? {} : { rad: radius }) },
            })
          }}
        >
          {nativeShadow || nativeInnerShadow || nativeGlow || nativeSoftEdge
            ? 'Switch to blur'
            : 'Add blur'}
        </Button>
      )}
      {!complexProgram && !nativeSoftEdge && !Array.isArray(geometry.style?.effects) && (
        <Button
          variant="secondary"
          className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
          aria-label={
            nativeShadow || nativeInnerShadow || nativeGlow || nativeBlur
              ? 'Switch to native soft edge'
              : 'Add native soft edge'
          }
          disabled={!editable}
          onClick={() => {
            if (!editable) return
            const previous = nativeGlow ?? nativeBlur ?? nativeShadow ?? nativeInnerShadow
            const radius = nativeGlow || nativeBlur ? previous.rad : previous?.blurRad
            submit({
              type: 'soft-edge',
              softEdge: {
                kind: 'softEdge',
                ...(!previous ? { rad: 38100 } : radius === undefined ? {} : { rad: radius }),
              },
            })
          }}
        >
          {nativeShadow || nativeInnerShadow || nativeGlow || nativeBlur
            ? 'Switch to soft edge'
            : 'Add soft edge'}
        </Button>
      )}
      {!complexProgram && !nativeGlow && !Array.isArray(geometry.style?.effects) && (
        <Button
          variant="secondary"
          className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
          aria-label={
            nativeShadow || nativeInnerShadow || nativeSoftEdge || nativeBlur
              ? 'Switch to native glow'
              : 'Add native glow'
          }
          disabled={!editable}
          onClick={() => {
            if (!editable) return
            submit({
              type: 'glow',
              glow: {
                kind: 'glow',
                ...(nativeSoftEdge || nativeBlur
                  ? (nativeSoftEdge ?? nativeBlur).rad === undefined
                    ? {}
                    : { rad: (nativeSoftEdge ?? nativeBlur).rad }
                  : !(nativeShadow || nativeInnerShadow)
                    ? { rad: 38100 }
                    : (nativeShadow ?? nativeInnerShadow).blurRad === undefined
                      ? {}
                      : { rad: (nativeShadow ?? nativeInnerShadow).blurRad }),
                color: authoredEffect?.color ?? { kind: 'srgb', value: '000000' },
              },
            })
          }}
        >
          {nativeShadow || nativeInnerShadow || nativeSoftEdge || nativeBlur
            ? 'Switch to glow'
            : 'Add glow'}
        </Button>
      )}
      {!complexProgram && !nativeInnerShadow && !Array.isArray(geometry.style?.effects) && (
        <Button
          variant="secondary"
          className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
          aria-label={
            nativeShadow || nativeGlow || nativeSoftEdge || nativeBlur
              ? 'Switch to native inner shadow'
              : 'Add native inner shadow'
          }
          disabled={!editable}
          onClick={() => {
            if (!editable) return
            const shadow = {
              kind: 'innerShdw',
              ...(!nativeShadow ? { dist: 152400, dir: 5400000 } : {}),
              ...(nativeBlur
                ? nativeBlur.rad === undefined
                  ? {}
                  : { blurRad: nativeBlur.rad }
                : !nativeShadow
                  ? { blurRad: 38100 }
                  : {}),
              color: authoredEffect?.color ??
                nativeShadow?.color ?? {
                  kind: 'srgb',
                  value: '000000',
                  transforms: [{ kind: 'alpha', value: 50000 }],
                },
            }
            for (const field of Object.keys(geometryCore.INNER_SHADOW_RANGES)) {
              if (nativeShadow && Object.hasOwn(nativeShadow, field))
                shadow[field] = nativeShadow[field]
            }
            submit({ type: 'inner-shadow', shadow })
          }}
        >
          {nativeShadow || nativeGlow || nativeSoftEdge || nativeBlur
            ? 'Switch to inner shadow'
            : 'Add inner shadow'}
        </Button>
      )}
      {!complexProgram &&
        !nativeShadow &&
        !nativeInnerShadow &&
        !Array.isArray(geometry.style?.effects) && (
          <Button
            variant="secondary"
            className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
            aria-label={
              nativeGlow || nativeSoftEdge || nativeBlur
                ? 'Switch to native outer shadow'
                : 'Add native shadow'
            }
            disabled={!editable}
            onClick={() => {
              if (editable)
                submit({
                  type: 'outer-shadow',
                  shadow: {
                    kind: 'outerShdw',
                    ...(nativeBlur
                      ? nativeBlur.rad === undefined
                        ? {}
                        : { blurRad: nativeBlur.rad }
                      : { blurRad: 38100 }),
                    dist: 152400,
                    dir: 5400000,
                    color: (nativeGlow ? authoredEffect?.color : undefined) ?? {
                      kind: 'srgb',
                      value: '000000',
                      transforms: [{ kind: 'alpha', value: 50000 }],
                    },
                  },
                })
            }}
          >
            {nativeGlow || nativeSoftEdge || nativeBlur ? 'Switch to outer shadow' : 'Add shadow'}
          </Button>
        )}
      {geometryColors.GEOMETRY_COLOR_KINDS.includes(geometry.style?.fill?.color?.kind) && (
        <NativeColorProperties
          key={instance.id}
          label="Native fill"
          color={geometry.style.fill.color}
          disabled={!editable}
          discardOnBlur
          onValue={(color) => submit({ type: 'fill-paint', color })}
        />
      )}
      {geometryColors.GEOMETRY_COLOR_KINDS.includes(geometry.style?.stroke?.color?.kind) && (
        <NativeColorProperties
          key={`${instance.id}:stroke`}
          label="Native stroke"
          color={geometry.style.stroke.color}
          disabled={!editable}
          onValue={(color) => submit({ type: 'stroke-color', color })}
        />
      )}
      {nativeStroke && (
        <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
          Native stroke dash
          <Select
            aria-label="Native stroke dash"
            className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
            disabled={!editable}
            value={currentDash?.kind === 'custom' ? 'custom' : (currentDash?.value ?? 'solid')}
            onChange={(event) =>
              submit({
                type: 'stroke-dash',
                dash:
                  event.target.value === 'custom'
                    ? sourceDash?.kind === 'custom'
                      ? sourceDash
                      : currentDash
                    : { kind: 'preset', value: event.target.value },
              })
            }
          >
            {(sourceDash?.kind === 'custom' || currentDash?.kind === 'custom') && (
              <option value="custom">Authored custom</option>
            )}
            {Object.keys(geometryCore.PRESET_DASH_PATTERNS).map((preset) => (
              <option key={preset} value={preset}>
                {DASH_LABELS[preset]}
              </option>
            ))}
          </Select>
        </label>
      )}
      {nativeStroke && (
        <>
          {nativeStroke.stroke === 'none' &&
            geometryStyles.geometryOutlineRestoration(pptxSemantic, instance.id) && (
              <Button
                variant="secondary"
                className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
                aria-label="Restore native outline"
                disabled={!editable}
                onClick={() => {
                  if (editable) submit({ type: 'stroke-restore' })
                }}
              >
                Restore outline
              </Button>
            )}
          {nativeStroke.stroke !== 'none' && (
            <Button
              variant="secondary"
              className="min-h-[44px] min-w-0 max-w-full border-solid border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
              aria-label="Remove native outline"
              disabled={!editable}
              onClick={() => {
                if (editable)
                  submit({
                    type: 'stroke-paint',
                    color: { kind: 'none' },
                    width: geometry.style.stroke.width,
                  })
              }}
            >
              Remove outline
            </Button>
          )}
          <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
            Native stroke cap
            <Select
              aria-label="Native stroke cap"
              className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
              disabled={!editable}
              value={geometry.style.stroke.cap ?? ''}
              onChange={(event) => submit({ type: 'stroke-cap', cap: event.target.value || null })}
            >
              <option value="">Default</option>
              <option value="flat">Flat</option>
              <option value="rnd">Round</option>
              <option value="sq">Square</option>
            </Select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
            Native stroke join
            <Select
              aria-label="Native stroke join"
              className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
              disabled={!editable}
              value={geometry.style.stroke.join?.kind ?? ''}
              onChange={(event) =>
                submit({
                  type: 'stroke-join',
                  join: event.target.value ? { kind: event.target.value } : null,
                })
              }
            >
              <option value="">Default</option>
              <option value="round">Round</option>
              <option value="bevel">Bevel</option>
              <option value="miter">Miter</option>
            </Select>
          </label>
          {geometry.style.stroke.join?.kind === 'miter' && (
            <NativeMiterLimitInput
              key={instance.id}
              join={geometry.style.stroke.join}
              disabled={!editable}
              onValue={(join) => submit({ type: 'stroke-join', join })}
            />
          )}
          {['headEnd', 'tailEnd'].map((end) => (
            <NativeLineEndProperties
              key={end}
              side={end === 'headEnd' ? 'Start' : 'End'}
              value={geometry.style.stroke[end]}
              disabled={!editable}
              onValue={(value) => submit({ type: 'stroke-end', end, value })}
            />
          ))}
        </>
      )}
      {arc && (
        <>
          <label className="flex min-w-0 flex-col gap-1 text-sm text-text-secondary [@media(pointer:coarse)]:text-[15px]">
            Native arc
            <Select
              aria-label="Native arc"
              className="border-text-secondary px-2 text-sm hover:border-text-primary active:border-text-primary disabled:opacity-80 [@media(pointer:coarse)]:text-[17px]"
              disabled={!editable}
              value={arc.key}
              onChange={(event) => setSelectedArc(event.target.value)}
            >
              {arcs.map((entry, index) => (
                <option key={entry.key} value={entry.key}>
                  Arc {index + 1}
                </option>
              ))}
            </Select>
          </label>
          <div className="text-sm text-text-secondary">
            Radii use the authored path grid. Angles use 60000 units per degree.
          </div>
          {[
            ['wR', 'Native arc width radius'],
            ['hR', 'Native arc height radius'],
            ['stAng', 'Native arc start angle'],
            ['swAng', 'Native arc sweep angle'],
          ].map(([parameter, label]) => (
            <GeometryNumberInput
              key={`${instance.id}:${arc.key}:${parameter}`}
              label={label}
              value={resolve(arc.command[parameter])}
              disabled={!editable}
              onValue={(value) =>
                submit({
                  type: 'arc-parameter',
                  pathId: arc.pathId,
                  commandIndex: arc.commandIndex,
                  parameter,
                  value,
                })
              }
            />
          ))}
        </>
      )}
      {point && (
        <>
          {(geometry.kind === 'custom' || geometry.connector !== undefined) && (
            <Button
              disabled={!editable}
              aria-pressed={pointEditingId === element.id}
              onClick={() => setPointEditingId(pointEditingId === element.id ? null : element.id)}
            >
              {pointEditingId === element.id ? 'Finish editing points' : 'Edit geometry points'}
            </Button>
          )}
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Geometry point
            <Select
              aria-label="Geometry point"
              value={point.componentId}
              onChange={(event) => setSelectedPoint(event.target.value)}
            >
              {points.map((entry, index) => (
                <option key={entry.componentId} value={entry.componentId}>
                  Point {index + 1}
                </option>
              ))}
            </Select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['x', 'y'].map((axis) => (
              <GeometryNumberInput
                key={`${point.componentId}:${axis}`}
                label={`Geometry point ${axis.toUpperCase()}`}
                value={
                  point.scale[axis] === 0 ? (point.localOffset?.[axis] ?? 0) : resolve(point[axis])
                }
                disabled={!editable || attachedPoint}
                onValue={(value) =>
                  submit({
                    type: 'control-point',
                    componentId: point.componentId,
                    ...(point.scale[axis] === 0
                      ? {
                          localOffset: {
                            x: point.localOffset?.x ?? 0,
                            y: point.localOffset?.y ?? 0,
                            [axis]: value,
                          },
                        }
                      : { [axis]: value }),
                  })
                }
              />
            ))}
          </div>
        </>
      )}
      {geometry.connector !== undefined && (
        <ConnectorProperties
          instance={instance}
          definition={semanticDefinition(pptxSemantic, instance.definitionId)}
          document={pptxSemantic}
          editable={editable}
          submit={submit}
        />
      )}
      {(geometry.adjustments || []).map((adjustment) => (
        <GeometryNumberInput
          key={adjustment.name}
          label={`Geometry adjustment ${adjustment.name}`}
          value={env[adjustment.name]}
          disabled={!editable}
          onValue={(value) => submit({ type: 'adjustment', name: adjustment.name, value })}
        />
      ))}
    </div>
  )
}
