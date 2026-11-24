// Source graphs are validated by the semantic normalizer before resolution.
// Resolved geometry and dependency traces are transient, never edit authority.
const { geometryProvider, geometryThemeCategories } = require('./pptx-geometry-style-records.js')
const { findInheritanceOverride } = require('./pptx-inheritance-targets.js')
const {
  semanticDefinition,
  semanticInstance,
  semanticInstances,
  semanticStyle,
  semanticStyles,
} = require('./pptx-semantic-records.js')
const {
  normalizeGeometryDocument,
  geometryFillPaint,
  geometryStrokePaint,
} = require('./pptx-geometry-document.js')
const { GEOMETRY_COLOR_KINDS, resolveGeometryColorPaint } = require('./pptx-geometry-color.js')
const { multiply, invert, transformPoint, IDENTITY } = require('./pptx-affine.js')
const {
  bindGradient,
  applyGradientPatch,
  gradientBindingPaint,
  gradientEditState,
} = require('./pptx-geometry-gradient-edit.js')

const strokeFields = [
  'color',
  'width',
  'dash',
  'cap',
  'compound',
  'alignment',
  'join',
  'headEnd',
  'tailEnd',
]
const fail = (reason, source) => {
  throw new TypeError(
    `Unsupported geometry style: ${reason}${source ? ` at ${source.partUri}:${source.componentLocator.path.join('.')}` : ''}`
  )
}
function authoredValue(value) {
  if (!value || typeof value !== 'object') return value
  if (Object.hasOwn(value, 'source') && Object.hasOwn(value, 'value'))
    return authoredValue(value.value)
  if (Array.isArray(value)) return value.map(authoredValue)
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, authoredValue(entry)])
  )
}
function contextFor(document, instanceId) {
  const instance = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
  if (!instance) fail('missing occurrence')
  const style = semanticStyle(document, instance.sourceBinding?.contextId) ?? document.styles?.[instance.sourceBinding?.contextId]
  const context = style?.payload
  if (!context) fail('missing source context')
  return { instance, context }
}
function structuralGeometry(document, instanceId) {
  const instance = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
  if (!instance) fail('missing occurrence')
  const { geometry } = geometryProvider(document, instance)
  const override = instance.overrides?.components?.[geometry?.componentId]?.geometryDocument
  if (override || !geometry || (document.schemaVersion !== 2 && document.schemaVersion !== 3)) return override ?? geometry
  const styleRec = semanticStyle(document, instance.sourceBinding?.contextId) ?? document.styles?.[instance.sourceBinding?.contextId]
  if (!styleRec?.payload?.transformDeclarationIds?.length) return geometry
  return sourceGeometryForContext(
    document,
    instance.sourceBinding.contextId,
    instance.sourceBinding.nativeExtent
  )
}
function geometryLocalExtent(document, instanceId) {
  if (document.schemaVersion === 2 || document.schemaVersion === 3) {
    const geometry = structuralGeometry(document, instanceId)
    if (geometry) return { cx: geometry.width, cy: geometry.height }
  }
  const instance = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
  const def = semanticDefinition(document, instance.definitionId) ?? document.definitions?.[instance.definitionId]
  return def.content.extent
}
function geometryFillFrame(document, instanceId) {
  const resolved = resolveGeometryStyle(document, instanceId)
  const ownerId = resolved.fillOwnerInstanceId
  if (ownerId === undefined) return undefined
  const owner = semanticInstance(document, ownerId) ?? document.instances?.[ownerId]
  const definition = semanticDefinition(document, owner.definitionId) ?? document.definitions?.[owner.definitionId]
  const declaration = (
    semanticStyle(document, definition.content.geometrySource.styleId) ??
    document.styles?.[definition.content.geometrySource.styleId]
  )?.payload
  const transform = authoredValue(declaration.transform)
  if (
    !transform?.off ||
    !transform.ext ||
    !transform.chOff ||
    !transform.chExt ||
    ![transform.ext.cx, transform.ext.cy, transform.chExt.cx, transform.chExt.cy].every(
      (value) => value > 0
    )
  )
    fail('missing group paint frame', declaration.transform?.source)
  const world = (id) => {
    let instance = semanticInstance(document, id) ?? document.instances?.[id],
      matrix = instance.localTransform
    while (instance.parentInstanceId !== null) {
      instance = semanticInstance(document, instance.parentInstanceId) ?? document.instances?.[instance.parentInstanceId]
      matrix = multiply(instance.localTransform, matrix)
    }
    return matrix
  }
  let width = transform.ext.cx,
    height = transform.ext.cy
  let frame = [
    transform.chExt.cx / transform.ext.cx,
    0,
    0,
    transform.chExt.cy / transform.ext.cy,
    transform.chOff.x,
    transform.chOff.y,
  ]
  if (resolved.style.fill?.gradient || resolved.style.fill?.blip) {
    // Native gradient/image receipts use occupied descendant
    // frames, including explicit fills but excluding hidden descendants.
    const children = new Map()
    for (const [, inst] of semanticInstances(document)) {
      if (!children.has(inst.parentInstanceId)) children.set(inst.parentInstanceId, [])
      children.get(inst.parentInstanceId).push(inst)
    }
    const points = []
    const visit = (parentId, matrix) => {
      for (const child of children.get(parentId) ?? []) {
        const definition = semanticDefinition(document, child.definitionId) ?? document.definitions?.[child.definitionId]
        if (
          child.lineage?.tombstone ||
          (child.overrides.hidden ?? child.hidden ?? definition?.content?.hidden ?? false)
        )
          continue
        const local = multiply(matrix, child.localTransform)
        if (definition.kind === 'group') visit(child.id, local)
        else {
          const extent = geometryLocalExtent(document, child.id)
          for (const x of [0, extent.cx])
            for (const y of [0, extent.cy]) points.push(transformPoint(local, { x, y }))
        }
      }
    }
    visit(ownerId, IDENTITY)
    if (!points.length) fail('missing visible group paint frame')
    const left = Math.min(...points.map((point) => point.x)),
      top = Math.min(...points.map((point) => point.y))
    width = Math.max(...points.map((point) => point.x)) - left
    height = Math.max(...points.map((point) => point.y)) - top
    if (width <= 0 || height <= 0) fail('collapsed group paint frame')
    frame = [1, 0, 0, 1, left, top]
  }
  const paintToWorld = multiply(world(ownerId), frame)
  return {
    ownerInstanceId: ownerId,
    componentId: declaration.paintComponentId,
    width,
    height,
    paintToWorld,
    paintToLeaf: multiply(invert(world(instanceId)), paintToWorld),
  }
}
function transformForContext(document, context) {
  const transform = {},
    properties = {}
  for (const key of ['off', 'ext', 'rot', 'flipH', 'flipV']) {
    const dependencyIds = []
    for (const styleId of context.transformDeclarationIds ?? []) {
      dependencyIds.push(`${styleId}:transform.${key}`)
      const styleRec = semanticStyle(document, styleId) ?? document.styles?.[styleId]
      const value = styleRec?.payload?.transform?.value?.[key]
      if (value === undefined) continue
      transform[key] = authoredValue(value)
      properties[key] = {
        authored: authoredValue(value),
        resolved: transform[key],
        source: value.source,
        dependencyIds,
        unsupportedReason: null,
      }
      break
    }
  }
  if (!transform.off || !transform.ext) fail('missing source transform')
  return { transform, properties }
}
function resolveGeometryTransform(document, instanceId) {
  const { context } = contextFor(document, instanceId)
  return transformForContext(document, context)
}
function sourceGeometryForContext(document, contextId, nativeExtent) {
  const styleRec = semanticStyle(document, contextId) ?? document.styles?.[contextId]
  const context = styleRec?.payload
  if (!context) fail('missing source context')
  const geomDef = semanticDefinition(document, context.geometry.definitionId) ?? document.definitions?.[context.geometry.definitionId]
  const geometry = structuredClone(geomDef.content.geometry)
  const { transform } = transformForContext(document, context)
  const extent = nativeExtent ?? transform.ext
  delete geometry.style
  return normalizeGeometryDocument({
    ...geometry,
    schemaVersion: 1,
    width: extent.cx,
    height: extent.cy,
  })
}
function resolveGeometryStyle(document, instanceId) {
  if (document.schemaVersion === 1)
    return {
      style: structuredClone(structuralGeometry(document, instanceId)?.style ?? {}),
      properties: {},
    }
  const { instance, context } = contextFor(document, instanceId)
  const { geometry } = geometryProvider(document, instance)
  let componentId = geometry?.componentId
  if (!componentId) {
    const instDef = semanticDefinition(document, instance.definitionId) ?? document.definitions?.[instance.definitionId]
    const styleId = instDef?.content?.geometrySource?.styleId
    const styleRec = styleId ? (semanticStyle(document, styleId) ?? document.styles?.[styleId]) : null
    componentId = styleRec?.payload?.paintComponentId
  }
  const localOverride = instance.overrides?.components?.[componentId]?.geometryStyle ?? {}
  const ownerOverride = findInheritanceOverride(document, instance)?.values?.geometryStyle ?? {}
  const override = {
    ...ownerOverride,
    ...localOverride,
    ...(ownerOverride.stroke || localOverride.stroke
      ? { stroke: { ...ownerOverride.stroke, ...localOverride.stroke } }
      : {}),
  }
  return resolveContextStyle(document, context, instanceId, override)
}
function resolveContextStyle(document, context, instanceId, override = {}, hiddenOnly = false) {
  const style = {},
    properties = {}
  let fillOwnerInstanceId, gradientBinding, gradientEdit
  const categories = geometryThemeCategories(document, context)
  let projectTheme
  for (const [id, value] of semanticStyles(document, { kind: 'theme-override' })) {
    if (
      categories.colors.styleId === context.themeId &&
      value.origin === 'project' &&
      value.baseStyleId === context.themeId
    ) {
      projectTheme = [id, value]
      break
    }
  }
  function color(value, dependencies, phColor, source) {
    if (['none', 'token'].includes(value.kind)) return structuredClone(value)
    let base
    if (value.kind === 'system') base = { kind: 'srgb', value: value.lastColor }
    else if (GEOMETRY_COLOR_KINDS.includes(value.kind))
      base = { kind: value.kind, value: structuredClone(value.value) }
    else if (value.value === 'phClr') {
      if (!phColor) fail('unbound phClr', source)
      base = phColor
    } else {
      let slot = value.value
      for (let index = 0; index < context.colorMapIds.length; index++) {
        const mapId = context.colorMapIds[index],
          map = semanticStyle(document, mapId) ?? document.styles?.[mapId]
        dependencies.push(`${mapId}:values.${slot}`)
        if (map.payload.kind === 'master') {
          let masterIndex = -1
          for (let i = 0; i < context.colorMapIds.length; i++) {
            const edgeStyle = semanticStyle(document, context.colorMapIds[i]) ?? document.styles?.[context.colorMapIds[i]]
            if (edgeStyle?.source?.partUri === context.edges[1]?.toPartUri) {
              masterIndex = i
              break
            }
          }
          index = masterIndex - 1
          continue
        }
        if (Object.hasOwn(map.payload.values, slot)) {
          slot = map.payload.values[slot].value
          break
        }
      }
      dependencies.push(`${categories.colors.styleId}:colors.${slot}`)
      let palette = categories.colors.value?.colors[slot]
      if (projectTheme && Object.hasOwn(projectTheme[1].values.colors ?? {}, slot)) {
        dependencies.push(`${projectTheme[0]}:colors.${slot}`)
        palette = projectTheme[1].values.colors[slot]
      }
      if (!palette) fail('missing theme color ' + slot, source)
      const raw = authoredValue(palette)
      if (raw.kind === 'scheme') fail('recursive theme palette', source)
      base =
        raw.kind === 'system'
          ? {
              kind: 'srgb',
              value: raw.lastColor,
              ...(raw.transforms ? { transforms: raw.transforms } : {}),
            }
          : raw
    }
    const transforms = [...(base.transforms ?? []), ...(value.transforms ?? [])]
    const result = {
      kind: base.kind,
      value: structuredClone(base.value),
      ...(transforms.length ? { transforms } : {}),
    }
    resolveGeometryColorPaint(result)
    return result
  }
  function paint(value, property, dependencies, phColor, source) {
    if (property === 'fill') {
      if (value.blip) {
        const { embed: _embed, ...parameters } = value.blip
        dependencies.push(parameters.bindingId)
        return { blip: parameters }
      }
      if (value.color) return { color: color(value.color, dependencies, phColor, source) }
      if (value.pattern)
        return {
          pattern: Object.fromEntries(
            Object.entries(value.pattern).map(([field, entry]) => [
              field,
              field === 'preset' ? entry : color(entry, dependencies, phColor, source),
            ])
          ),
        }
      return {
        gradient: {
          ...value.gradient,
          stops: value.gradient.stops.map((stop) => ({
            ...stop,
            color: color(stop.color, dependencies, phColor, source),
          })),
        },
      }
    }
    if (property === 'effects') {
      const effect = (entry) => ({
        ...entry,
        ...(entry.effects ? { effects: entry.effects.map(effect) } : {}),
        ...(entry.color ? { color: color(entry.color, dependencies, phColor, source) } : {}),
        ...(entry.fill ? { fill: paint(entry.fill, 'fill', dependencies, phColor, source) } : {}),
      })
      return effect(value)
    }
    return property === 'color' ? color(value, dependencies, phColor, source) : value
  }
  function matrix(styleId, referenceKey, dependencies) {
    const styleRec = semanticStyle(document, styleId) ?? document.styles?.[styleId]
    const reference = styleRec?.payload?.styleRefs?.[referenceKey]
    const binding = context.matrixBindings[referenceKey]
    if (!binding || binding.declarationId !== styleId)
      fail('unbound style matrix', reference.source)
    dependencies.push(`${styleId}:styleRefs.${referenceKey}`)
    if (binding.entryIndex === null)
      return {
        value:
          referenceKey === 'effectRef'
            ? { kind: 'list', effects: [] }
            : { color: { kind: 'none' } },
        source: reference.source,
      }
    const entry = categories.format.value[binding.list][binding.entryIndex]
    if (entry.value.kind === 'unsupported') fail(entry.value.reason, entry.source)
    dependencies.push(`${categories.format.styleId}:${binding.list}.${binding.entryIndex}`)
    const value = authoredValue(entry)
    return {
      value: referenceKey === 'effectRef' ? value.effects : value,
      source: entry.source,
      phColor: color(
        authoredValue(reference.value.color),
        dependencies,
        undefined,
        reference.value.color.source
      ),
    }
  }
  function property(key, leaf) {
    const traceKey = leaf ? `stroke.${leaf}` : key
    const dependencyIds = []
    const overridden = leaf
      ? Object.hasOwn(override.stroke ?? {}, leaf)
      : Object.hasOwn(override, key)
    const patternPatch = !leaf && key === 'fill' ? override.fill?.pattern : undefined
    const imagePatch = !leaf && key === 'fill' ? override.fill?.blip : undefined
    const gradientPatch = !leaf && key === 'fill' ? override.fill?.gradientPatch : undefined
    let selected
    if (overridden && !patternPatch && !imagePatch && (!gradientPatch || override.fill.gradient)) {
      selected = {
        value: leaf
          ? override.stroke[leaf]
          : gradientPatch
            ? { gradient: override.fill.gradient }
            : override[key],
        source: null,
      }
      dependencyIds.push(`${instanceId}:geometryStyle.${traceKey}`)
      const placeholderColor = (value) =>
        value &&
        typeof value === 'object' &&
        ((value.kind === 'scheme' && value.value === 'phClr') ||
          Object.values(value).some(placeholderColor))
      if (key === 'effects' && placeholderColor(selected.value)) {
        for (const styleId of context.declarationIds ?? []) {
          const declarations = (semanticStyle(document, styleId) ?? document.styles?.[styleId])?.payload
          dependencyIds.push(`${styleId}:effects`)
          if (declarations.properties.effects !== undefined) break
          if (declarations.styleRefs.effectRef) {
            selected.phColor = matrix(styleId, 'effectRef', dependencyIds).phColor
            break
          }
        }
      }
    } else {
      const referenceKey = { fill: 'fillRef', stroke: 'lnRef', effects: 'effectRef' }[key]
      for (const styleId of context.declarationIds ?? []) {
        const declarations = (semanticStyle(document, styleId) ?? document.styles?.[styleId])?.payload
        dependencyIds.push(`${styleId}:${traceKey}`)
        const direct = leaf
          ? declarations.properties.stroke?.value[leaf]
          : declarations.properties[key]
        if (direct !== undefined) {
          selected = { value: authoredValue(direct), source: direct.source }
          break
        }
        if (declarations.styleRefs[referenceKey]) {
          const entry = matrix(styleId, referenceKey, dependencyIds)
          if (!leaf || Object.hasOwn(entry.value, leaf)) {
            selected = { ...entry, value: leaf ? entry.value[leaf] : entry.value }
            break
          }
        }
      }
    }
    let patchedPaint
    const currentInst = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
    const currentDef = currentInst ? (semanticDefinition(document, currentInst.definitionId) ?? document.definitions?.[currentInst.definitionId]) : null
    if (
      key === 'fill' &&
      selected &&
      currentDef?.kind === 'group'
    )
      fillOwnerInstanceId = instanceId
    if (key === 'fill' && selected?.value?.group === true) {
      let parentId = currentInst?.parentInstanceId
      let owner, ownerPaint, fallback
      while (parentId !== null && parentId !== undefined) {
        const parent = semanticInstance(document, parentId) ?? document.instances?.[parentId]
        const definition = parent ? (semanticDefinition(document, parent.definitionId) ?? document.definitions?.[parent.definitionId]) : null
        if (definition?.kind === 'group' && definition.origin !== 'project') {
          const candidate = resolveGeometryStyle(document, parent.id)
          fallback ??= { owner: parent, paint: candidate }
          dependencyIds.push(`${parent.id}:group-fill`, ...candidate.properties.fill.dependencyIds)
          if (candidate.style.fill && candidate.style.fill.color?.kind !== 'none') {
            owner = parent
            ownerPaint = candidate
            break
          }
        }
        parentId = parent.parentInstanceId
      }
      if (!owner && fallback) ({ owner, paint: ownerPaint } = fallback)
      if (!owner) fail('unbound group fill', selected.source)
      if (patternPatch && !ownerPaint.style.fill?.pattern)
        fail('group fill no longer supplies the descendant pattern patch', selected.source)
      const ownerFill = ownerPaint.properties.fill
      fillOwnerInstanceId = ownerPaint.fillOwnerInstanceId ?? owner.id
      dependencyIds.push(`${owner.id}:group-fill`, ...ownerFill.dependencyIds)
      selected = {
        value: ownerFill.authored ?? { color: { kind: 'none' } },
        source: ownerFill.source,
      }
      // Omitted group declarations stay absent in source records. The root
      // omission case paints no ink in the captured native reference.
      patchedPaint = ownerPaint.style.fill ?? { color: { kind: 'none' } }
      gradientBinding = ownerPaint.gradientBinding
    }
    if (key === 'fill' && selected?.value?.gradient && !gradientBinding) {
      const provider = selected
      gradientBinding = bindGradient(
        provider.value.gradient,
        JSON.stringify([
          (semanticInstance(document, instanceId) ?? document.instances?.[instanceId])?.definitionId,
          // Keep the authored receipt identity stable across canonical storage
          // sorting without changing its existing serialized field layout.
          provider.source
            ? {
                partUri: provider.source.partUri,
                preconditionHash: provider.source.preconditionHash,
                componentLocator: {
                  path: provider.source.componentLocator.path,
                  preconditionHash: provider.source.componentLocator.preconditionHash,
                },
              }
            : 'explicit-gradient',
        ]),
        instanceId,
        (value) => color(value, dependencyIds, provider.phColor, provider.source)
      )
    }
    if (key === 'fill' && (gradientBinding || gradientPatch)) {
      const base = gradientBinding
      if (gradientPatch) {
        dependencyIds.push(`${instanceId}:geometryStyle.fill.gradientPatch`)
        gradientBinding = applyGradientPatch(base, gradientPatch, instanceId, (value) =>
          color(value, dependencyIds, undefined, null)
        )
      }
      const gradient = gradientBindingPaint(gradientBinding)
      patchedPaint = { gradient }
      gradientEdit = gradientEditState(base, gradientBinding, gradientPatch, gradient)
    }
    if (imagePatch) {
      if (!selected?.value?.blip) fail('missing source image fill')
      const blip = { ...selected.value.blip }
      for (const [field, entry] of Object.entries(imagePatch)) {
        dependencyIds.push(`${instanceId}:geometryStyle.fill.blip.${field}`)
        if (entry === null) delete blip[field]
        else blip[field] = entry
      }
      patchedPaint = paint({ blip }, 'fill', dependencyIds, selected.phColor, selected.source)
      selected = { value: { blip }, source: selected.source }
    }
    if (patternPatch) {
      const inherited = { ...selected?.value?.pattern }
      for (const field of Object.keys(patternPatch)) delete inherited[field]
      const pattern = paint(
        { pattern: inherited },
        'fill',
        dependencyIds,
        selected?.phColor,
        selected?.source
      ).pattern
      for (const [field, entry] of Object.entries(patternPatch)) {
        dependencyIds.push(`${instanceId}:geometryStyle.fill.pattern.${field}`)
        if (entry !== null)
          pattern[field] = field === 'preset' ? entry : color(entry, dependencyIds, undefined, null)
      }
      patchedPaint = { pattern }
      selected = {
        value: { pattern: { ...selected?.value?.pattern, ...patternPatch } },
        source: selected?.source ?? null,
      }
    }
    if (!selected) {
      let derivedFill
      const inst = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
      const instContext = inst?.sourceBinding?.contextId
        ? (semanticStyle(document, inst.sourceBinding.contextId) ?? document.styles?.[inst.sourceBinding.contextId])
        : null
      if (
        key === 'fill' &&
        instContext?.kind === 'geometry-context'
      ) {
        let parentId = inst.parentInstanceId
        while (parentId !== null && parentId !== undefined) {
          const parent = semanticInstance(document, parentId) ?? document.instances?.[parentId]
          if (!parent) break
          const definition = semanticDefinition(document, parent.definitionId) ?? document.definitions?.[parent.definitionId]
          if (definition?.kind === 'group' && definition.origin !== 'project') {
            derivedFill = { color: { kind: 'none' } }
            style.fill = derivedFill
            break
          }
          parentId = parent.parentInstanceId
        }
      }
      properties[traceKey] = {
        authored: null,
        resolved: derivedFill ?? null,
        source: null,
        dependencyIds,
        unsupportedReason: derivedFill ? null : 'missing-declaration',
      }
      return
    }
    const resolved =
      patchedPaint ??
      (selected.value === null
        ? null
        : paint(selected.value, leaf ?? key, dependencyIds, selected.phColor, selected.source))
    properties[traceKey] = {
      authored: structuredClone(selected.value),
      resolved,
      source: selected.source,
      dependencyIds: [...new Set(dependencyIds)],
      unsupportedReason: null,
    }
    if (leaf) {
      if (resolved !== null) style.stroke = { ...style.stroke, [leaf]: resolved }
    } else style[key] = resolved
  }
  if (hiddenOnly)
    return Object.fromEntries(
      context.declarationIds.flatMap((styleId) => {
        const styleRec = semanticStyle(document, styleId) ?? document.styles?.[styleId]
        const hidden = styleRec?.payload?.hiddenStroke
        if (!hidden) return []
        const authored = authoredValue(hidden)
        const resolved = { ...authored, color: color(authored.color, [], undefined, hidden.source) }
        geometryStrokePaint({ style: { stroke: resolved } })
        return [[styleId, authored]]
      })
    )
  property('fill')
  for (const field of strokeFields) property('stroke', field)
  property('effects')
  return {
    style,
    properties,
    ...(fillOwnerInstanceId === undefined ? {} : { fillOwnerInstanceId }),
    ...(gradientBinding ? { gradientBinding, gradientEdit } : {}),
  }
}
function validateHiddenGeometryStrokes(document, contextId) {
  const styleRec = semanticStyle(document, contextId) ?? document.styles?.[contextId]
  const context = styleRec?.payload
  if (!context) fail('missing source context')
  resolveContextStyle(document, context, undefined, {}, true)
}
function geometryOutlineRestoration(document, instanceId) {
  if (document.schemaVersion !== 2 && document.schemaVersion !== 3) return null
  const { context } = contextFor(document, instanceId)
  if (resolveGeometryStyle(document, instanceId).style.stroke?.color?.kind !== 'none') return null
  const source = resolveContextStyle(document, context, instanceId)
  const color = source.style.stroke?.color
  if (!color) return null
  if (color.kind !== 'none') return { kind: 'inherit' }
  const governing = [...context.declarationIds]
    .reverse()
    .find((styleId) =>
      source.properties['stroke.color'].dependencyIds.includes(`${styleId}:stroke.color`)
    )
  const hidden = resolveContextStyle(document, context, instanceId, {}, true)[governing]
  if (!hidden) return null
  const stroke = structuredClone(hidden)
  if (stroke.color.kind === 'system') {
    const { lastColor, transforms } = stroke.color
    stroke.color = { kind: 'srgb', value: lastColor, ...(transforms ? { transforms } : {}) }
  }
  return { kind: 'hidden', stroke }
}
function materializeGeometry(document, instanceId) {
  const source = structuralGeometry(document, instanceId)
  if (source === undefined) return undefined
  const instance = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
  if (document.schemaVersion === 1 || !instance?.sourceBinding?.contextId) return normalizeGeometryDocument(source)
  const structural = structuredClone(source)
  delete structural.style
  return normalizeGeometryDocument({
    ...structural,
    style: resolveGeometryStyle(document, instanceId).style,
  })
}
function geometryCompatibilityElement(document, element, geometry) {
  if ((document.schemaVersion !== 2 && document.schemaVersion !== 3) || !element.pptxInstanceId) return element
  const regenerated = { ...element }
  for (const key of ['pptxBlipAsset', 'pptxBlipDerivedAssets']) delete regenerated[key]
  const geom = arguments.length >= 3 ? geometry : materializeGeometry(document, element.pptxInstanceId)
  if (!geom) return regenerated
  for (const key of ['fill', 'fillOpacity', 'stroke', 'strokeWidth', 'strokeOpacity']) delete regenerated[key]
  const styleRec = geom.style?.fill?.blip
    ? (semanticStyle(document, geom.style.fill.blip.bindingId) ?? document.styles?.[geom.style.fill.blip.bindingId])
    : null
  const binding = styleRec?.payload
  const instance = semanticInstance(document, element.pptxInstanceId) ?? document.instances?.[element.pptxInstanceId]
  let world = instance.localTransform
  let parentId = instance.parentInstanceId
  while (parentId !== null) {
    const parent = semanticInstance(document, parentId) ?? document.instances?.[parentId]
    world = multiply(parent.localTransform, world)
    parentId = parent.parentInstanceId
  }
  const local = geometryLocalExtent(document, instance.id)
  return {
    ...regenerated,
    ...(binding ? { pptxBlipAsset: binding.asset,
      ...(binding.derivedAssets ? { pptxBlipDerivedAssets: binding.derivedAssets } : {}) } : {}),
    ...geometryFillPaint(geom),
    ...geometryStrokePaint(geom),
    width: (Math.hypot(world[0], world[1]) * local.cx) / 9525,
    height: (Math.hypot(world[2], world[3]) * local.cy) / 9525,
  }
}
module.exports = {
  structuralGeometry,
  geometryLocalExtent,
  geometryFillFrame,
  sourceGeometryForContext,
  resolveGeometryTransform,
  resolveGeometryStyle,
  validateHiddenGeometryStrokes,
  geometryOutlineRestoration,
  materializeGeometry,
  geometryCompatibilityElement,
}
module.exports.default = module.exports
