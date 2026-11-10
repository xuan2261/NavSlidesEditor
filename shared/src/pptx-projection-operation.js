const { normalizePptxSemanticDocument } = require('./pptx-semantic-document.js')
const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation.js')
const {
  SERIES_VALUES,
  GEOMETRY_EDIT,
  GROUP_FILL_EDIT,
  assertSeriesValues,
  getProjectionCapabilities,
  projectChartData,
  assertProjectionChartBinding,
} = require('./pptx-projection-capabilities.js')
const {
  editGeometryDocument,
  geometryFillPaint,
  geometryStrokePaint,
  normalizeGeometryDocument,
} = require('./pptx-geometry-document.js')
const {
  deriveConnectorGeometry,
  connectorEndpointLocators,
} = require('./pptx-semantic-connectors.js')
const { geometryProvider } = require('./pptx-geometry-style-records.js')
const {
  materializeGeometry,
  geometryOutlineRestoration,
  resolveGeometryStyle,
} = require('./pptx-geometry-style-resolution.js')
const { gradientPatch, mergeGradientPatch } = require('./pptx-geometry-gradient-edit.js')
const { cloneTextData } = require('./pptx-text-document.js')
const { applyFamilyPresentationOperation } = require('./pptx-family-operations-command')
const { PICTURE_EDIT, applyPicturePresentationOperation } = require('./pptx-picture-operations')
const { MEDIA_EDIT, applyMediaPresentationOperation } = require('./pptx-media-operations')
const { TIMING_EDIT, applyTimingPresentationOperation } = require('./pptx-timing-operations')
const {
  INHERITANCE_EDIT,
  applyInheritancePresentationOperation,
} = require('./pptx-inheritance-operations')

function applyPresentationProjectionOperation(input, operation) {
  const descriptor = operation && Object.getOwnPropertyDescriptor(operation, 'type')
  if (!descriptor || !Object.hasOwn(descriptor, 'value'))
    throw new TypeError('Unsupported projection operation')
  const type = descriptor.value
  if (type === INHERITANCE_EDIT) return applyInheritancePresentationOperation(input, operation)
  if (type === PICTURE_EDIT) return applyPicturePresentationOperation(input, operation)
  if (type === MEDIA_EDIT) return applyMediaPresentationOperation(input, operation)
  if (type === TIMING_EDIT) return applyTimingPresentationOperation(input, operation)
  if (['table.edit', 'chart.edit', 'smartart.edit', 'omml.edit', 'svg.edit'].includes(type))
    return applyFamilyPresentationOperation(input, operation)
  if (
    !operation ||
    typeof operation !== 'object' ||
    Array.isArray(operation) ||
    Object.keys(operation).length !== 4 ||
    Object.keys(operation).some(
      (key) =>
        ![
          'type',
          'instanceId',
          'componentId',
          [GEOMETRY_EDIT, GROUP_FILL_EDIT].includes(operation.type) ? 'command' : 'values',
        ].includes(key)
    ) ||
    ![SERIES_VALUES, GEOMETRY_EDIT, GROUP_FILL_EDIT].includes(operation.type)
  )
    throw new TypeError('Unsupported projection operation')
  const presentation = normalizeSemanticPresentation(input)
  const document = presentation.pptxSemantic
  if (
    !getProjectionCapabilities(document, operation.instanceId).operations.includes(operation.type)
  )
    throw new TypeError('Projection operation is not available')
  const instance = document.instances[operation.instanceId]
  const definition = document.definitions[instance.definitionId]
  if (operation.type === GROUP_FILL_EDIT) {
    const declaration = document.styles[definition.content.geometrySource.styleId].payload
    if (operation.componentId !== declaration.paintComponentId)
      throw new TypeError('Group fill operation targets a different source paint component')
    const command = operation.command
    const type = command && Object.getOwnPropertyDescriptor(command, 'type')?.value
    const field = {
      'fill-paint': 'color',
      'fill-gradient': 'gradient',
      'fill-gradient-patch': 'gradientPatch',
      'fill-pattern': 'pattern',
      'fill-blip': 'blip',
    }[type]
    const keys = type === 'reset' ? ['type'] : ['type', field === 'gradientPatch' ? 'patch' : field]
    if (
      !command ||
      (!field && type !== 'reset') ||
      Object.getPrototypeOf(command) !== Object.prototype ||
      Reflect.ownKeys(command).length !== keys.length ||
      keys.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(command, key)
        return !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')
      })
    )
      throw new TypeError('Invalid group fill command')
    const components = { ...instance.overrides.components }
    const previous = components[operation.componentId]?.geometryStyle?.fill
    if (type === 'reset') delete components[operation.componentId]
    else if (type === 'fill-gradient-patch') {
      gradientPatch(command.patch)
      if (!resolveGeometryStyle(document, instance.id).style.fill?.gradient)
        throw new TypeError('Missing gradient provider')
      components[operation.componentId] = {
        geometryStyle: {
          fill: {
            ...(previous?.gradient ? { gradient: previous.gradient } : {}),
            gradientPatch: mergeGradientPatch(previous?.gradientPatch, command.patch),
          },
        },
      }
    } else {
      const patch = ['pattern', 'blip'].includes(field)
      components[operation.componentId] = {
        geometryStyle: {
          fill: {
            [field]: patch
              ? { ...previous?.[field], ...command[field] }
              : structuredClone(command[field]),
          },
        },
      }
    }
    const overrides = { ...instance.overrides }
    if (Object.keys(components).length) overrides.components = components
    else delete overrides.components
    let matched = false
    const visit = (slides, ancestorLocked = false) => {
      for (const slide of slides) {
        const locked = ancestorLocked || slide.locked
        if (slide.id === instance.slideId) {
          if (matched || locked) throw new TypeError('Locked or ambiguous group fill slide')
          matched = true
        }
        visit(slide.children || [], locked)
      }
    }
    visit(presentation.slides)
    if (!matched) throw new TypeError('Missing group fill slide')
    return normalizeSemanticPresentation({
      ...presentation,
      pptxSemantic: {
        ...document,
        instances: { ...document.instances, [instance.id]: { ...instance, overrides } },
      },
    })
  }
  if (
    operation.type === SERIES_VALUES &&
    !definition.content.chartProjection.chartData.datasets.some(
      (series) => series.componentId === operation.componentId
    )
  )
    throw new TypeError('Projection operation targets an unknown series component')
  let componentOverride
  let connectorBindings = instance.connectorBindings
  if (operation.type === SERIES_VALUES) {
    assertSeriesValues(operation.values, definition.content.chartProjection.chartData.labels.length)
    componentOverride = { values: [...operation.values] }
  } else {
    const baseline = geometryProvider(document, instance).geometry
    if (operation.componentId !== baseline.componentId)
      throw new TypeError('Geometry operation targets a different source component')
    const previous = instance.overrides.components?.[baseline.componentId] ?? {}
    const geometry = materializeGeometry(document, instance.id)
    const command = operation.command
    const commandType = command && Object.getOwnPropertyDescriptor(command, 'type')?.value
    if (commandType === 'extent' && document.schemaVersion !== 2)
      throw new TypeError('Native extent editing requires a linked source context')
    if (['connector-detach', 'connector-attach'].includes(commandType)) {
      const fields =
        commandType === 'connector-detach'
          ? ['type', 'end']
          : ['type', 'end', 'targetInstanceId', 'index']
      const descriptors = Object.getOwnPropertyDescriptors(command)
      if (
        !geometry.connector ||
        !connectorBindings ||
        Object.getPrototypeOf(command) !== Object.prototype ||
        Reflect.ownKeys(command).length !== fields.length ||
        fields.some(
          (field) => !descriptors[field]?.enumerable || !Object.hasOwn(descriptors[field], 'value')
        ) ||
        !['start', 'end'].includes(command.end)
      )
        throw new TypeError('Invalid connector attachment command')
      if (commandType === 'connector-detach') {
        if (!connectorBindings[command.end])
          throw new TypeError('Connector endpoint is already detached')
        const resolved = deriveConnectorGeometry(document, instance.id)
        const frozen = structuredClone(geometry),
          endpoint = connectorEndpointLocators(resolved)[command.end]
        frozen.paths[endpoint.pathIndex].commands[endpoint.commandIndex].points[
          endpoint.pointIndex
        ] = structuredClone(
          resolved.paths[endpoint.pathIndex].commands[endpoint.commandIndex].points[
            endpoint.pointIndex
          ]
        )
        if (document.schemaVersion === 2) delete frozen.style
        componentOverride = { ...previous, geometryDocument: normalizeGeometryDocument(frozen) }
        connectorBindings = { ...connectorBindings, [command.end]: null }
      } else {
        componentOverride = document.schemaVersion === 2 ? previous : { geometryDocument: geometry }
        connectorBindings = {
          ...connectorBindings,
          [command.end]: {
            targetInstanceId: command.targetInstanceId,
            index: command.index,
          },
        }
      }
    } else if (commandType === 'stroke-restore') {
      const descriptors = Object.getOwnPropertyDescriptors(command)
      if (
        Object.getPrototypeOf(command) !== Object.prototype ||
        Reflect.ownKeys(command).length !== 1 ||
        !descriptors.type?.enumerable ||
        !Object.hasOwn(descriptors.type, 'value')
      )
        throw new TypeError('Invalid outline restoration command')
      const candidate = geometryOutlineRestoration(document, instance.id)
      if (!candidate) throw new TypeError('No source outline restoration is available')
      const stroke = { ...previous.geometryStyle?.stroke }
      if (candidate.kind === 'inherit') delete stroke.color
      else {
        stroke.color = candidate.stroke.color
        for (const [field, value] of Object.entries(candidate.stroke))
          if (!Object.hasOwn(stroke, field)) stroke[field] = value
      }
      componentOverride = {
        ...previous,
        geometryStyle: { ...previous.geometryStyle, stroke },
      }
    } else if (commandType === 'effects' && document.schemaVersion === 2) {
      const intent = cloneTextData(command)
      if (Object.keys(intent).length !== 2 || !Object.hasOwn(intent, 'effects'))
        throw new TypeError('Invalid whole-effects command')
      componentOverride = {
        ...previous,
        geometryStyle: {
          ...previous.geometryStyle,
          effects: intent.effects === null ? { kind: 'list', effects: [] } : intent.effects,
        },
      }
    } else if (
      document.schemaVersion === 2 &&
      ['outer-shadow', 'inner-shadow', 'glow', 'soft-edge', 'blur'].includes(commandType)
    ) {
      const intent = cloneTextData(command)
      const field = { 'soft-edge': 'softEdge', glow: 'glow', blur: 'blur' }[commandType] ?? 'shadow'
      const kind = {
        'outer-shadow': 'outerShdw',
        'inner-shadow': 'innerShdw',
        'soft-edge': 'softEdge',
        glow: 'glow',
        blur: 'blur',
      }[commandType]
      if (
        Object.keys(intent).length !== 2 ||
        !Object.hasOwn(intent, field) ||
        (intent[field] !== null && intent[field]?.kind !== kind)
      )
        throw new TypeError('Invalid effect command')
      componentOverride = {
        ...previous,
        geometryStyle: {
          ...previous.geometryStyle,
          effects: { kind: 'list', effects: intent[field] === null ? [] : [intent[field]] },
        },
      }
    } else if (commandType === 'fill-gradient-patch' && document.schemaVersion === 2) {
      if (
        Object.getPrototypeOf(command) !== Object.prototype ||
        Reflect.ownKeys(command).length !== 2 ||
        !['type', 'patch'].every((key) => {
          const descriptor = Object.getOwnPropertyDescriptor(command, key)
          return descriptor?.enumerable && Object.hasOwn(descriptor, 'value')
        })
      )
        throw new TypeError('Invalid gradient patch command')
      gradientPatch(command.patch)
      if (!geometry.style.fill?.gradient) throw new TypeError('Missing gradient provider')
      const fill = previous.geometryStyle?.fill
      componentOverride = {
        ...previous,
        geometryStyle: {
          ...previous.geometryStyle,
          fill: {
            ...(fill?.gradient ? { gradient: fill.gradient } : {}),
            gradientPatch: mergeGradientPatch(fill?.gradientPatch, command.patch),
          },
        },
      }
    } else {
      const edited = editGeometryDocument(geometry, command)
      if (geometry.connector && command.type === 'control-point') {
        const endpoints = connectorEndpointLocators(geometry)
        const attached = ['start', 'end'].some(
          (end) => connectorBindings?.[end] && endpoints?.[end].componentId === command.componentId
        )
        if (attached)
          throw new TypeError('Explicitly detach the connector endpoint before moving it')
      }
      if (document.schemaVersion === 1) componentOverride = { geometryDocument: edited }
      else if (
        ['control-point', 'arc-parameter', 'adjustment', 'connector', 'extent'].includes(
          command.type
        )
      ) {
        delete edited.style
        componentOverride = { ...previous, geometryDocument: edited }
      } else {
        const style = { ...previous.geometryStyle }
        if (['fill-paint', 'fill-gradient'].includes(command.type)) style.fill = edited.style.fill
        else if (command.type === 'fill-pattern')
          style.fill = {
            pattern: { ...style.fill?.pattern, ...command.pattern },
          }
        else if (command.type === 'fill-blip')
          style.fill = { blip: { ...style.fill?.blip, ...command.blip } }
        else if (command.type === 'outer-shadow') style.effects = edited.style.effects
        else {
          const stroke = { ...style.stroke }
          if (command.type === 'stroke-paint') {
            stroke.color = command.color
            stroke.width = command.width
          } else if (command.type === 'stroke-color') stroke.color = command.color
          else if (command.type === 'stroke-dash') stroke.dash = command.dash
          else if (command.type === 'stroke-cap') stroke.cap = command.cap
          else if (command.type === 'stroke-join') stroke.join = command.join
          else if (command.type === 'stroke-end') stroke[command.end] = command.value
          style.stroke = stroke
        }
        componentOverride = { ...previous, geometryStyle: style }
      }
    }
  }
  const next = normalizePptxSemanticDocument({
    ...document,
    instances: {
      ...document.instances,
      [instance.id]: {
        ...instance,
        ...(connectorBindings ? { connectorBindings } : {}),
        overrides: {
          ...instance.overrides,
          components: {
            ...instance.overrides.components,
            [operation.componentId]: componentOverride,
          },
        },
      },
    },
  })
  let matched = false
  function updateSlides(slides, ancestorLocked = false) {
    return slides.map((slide) => {
      const locked = ancestorLocked || slide.locked
      const elements = (slide.elements || []).map((element) => {
        if (element.pptxInstanceId !== instance.id) return element
        if (matched || slide.id !== instance.slideId || locked || element.locked)
          throw new TypeError('Locked or ambiguous projection operation target')
        if (operation.type === SERIES_VALUES) assertProjectionChartBinding(document, element)
        matched = true
        const effective =
          operation.type === GEOMETRY_EDIT ? materializeGeometry(next, instance.id) : null
        const fill = effective ? geometryFillPaint(effective) : undefined
        return operation.type === SERIES_VALUES
          ? { ...element, chartData: projectChartData(next, instance.id) }
          : {
              ...element,
              ...geometryStrokePaint(effective),
              ...fill,
              ...(fill ? { fillOpacity: fill.fillOpacity ?? 1 } : {}),
            }
      })
      return {
        ...slide,
        elements,
        ...(slide.children ? { children: updateSlides(slide.children, locked) } : {}),
      }
    })
  }
  const slides = updateSlides(presentation.slides)
  if (!matched) throw new TypeError('Missing projection operation target')
  return normalizeSemanticPresentation({ ...presentation, slides, pptxSemantic: next })
}

module.exports = {
  applyPresentationProjectionOperation,
  INHERITANCE_EDIT,
}
