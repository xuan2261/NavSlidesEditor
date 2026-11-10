const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const {
  semanticDefinition, semanticInstance, semanticInstances, semanticStyle, semanticStyles,
} = require('./pptx-semantic-records')

function fail(detail) { throw new TypeError(`Inherited edit ${detail}`) }
function textContext(document, instance) {
  const payload = semanticStyle(document, instance.textSourceBinding?.contextId)?.payload
  return payload && expandTextContext(payload, { styles: document.styles })
}
function dependsOn(document, instance, definitionId) {
  if (instance.definitionId === definitionId) return true
  let def = semanticDefinition(document, instance.definitionId)
  const visited = new Set([instance.definitionId])
  while (def?.parentDefinitionId) {
    if (def.parentDefinitionId === definitionId) return true
    if (visited.has(def.parentDefinitionId) || visited.size > 256) fail('dependency cycle')
    visited.add(def.parentDefinitionId)
    def = semanticDefinition(document, def.parentDefinitionId)
  }
  const context = textContext(document, instance)
  if (context && Object.values(context.bindings).includes(definitionId)) return true
  const geometry = semanticStyle(document, instance.sourceBinding?.contextId)?.payload
  return [...(geometry?.declarationIds ?? []), ...(geometry?.transformDeclarationIds ?? [])]
    .some((id) => semanticStyle(document, id)?.payload?.definitionId === definitionId)
}
const ALL_FILL_VARIANT_KEYS = new Set(['color', 'pattern', 'gradient', 'gradientPatch', 'blip', 'group'])

function fillVariant(fill) {
  if (!fill || typeof fill !== 'object') return null
  if (fill.pattern !== undefined) return 'pattern'
  if (fill.color !== undefined) return 'color'
  if (fill.gradient !== undefined || fill.gradientPatch !== undefined) return 'gradient'
  if (fill.blip !== undefined) return 'blip'
  if (fill.group !== undefined) return 'group'
  const key = Object.keys(fill).find((k) => fill[k] !== undefined)
  return key ?? null
}

function mergeLeaves(prev, next) {
  if (!prev) return next ? { ...next } : next
  if (!next) return prev ? { ...prev } : prev
  const result = { ...prev }
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

function mergeFill(prevFill, nextFill) {
  if (!prevFill && !nextFill) return undefined
  if (!prevFill) return nextFill ? { ...nextFill } : undefined
  if (!nextFill) return prevFill ? { ...prevFill } : undefined
  if (typeof prevFill !== 'object') return nextFill
  if (typeof nextFill !== 'object') return prevFill

  const prevVariant = fillVariant(prevFill)
  const nextVariant = fillVariant(nextFill)

  if (!nextVariant) {
    return { ...prevFill }
  }

  const result = {}
  for (const [key, value] of Object.entries(prevFill)) {
    if (!ALL_FILL_VARIANT_KEYS.has(key) && value !== undefined) {
      result[key] = value
    }
  }

  if (!prevVariant || prevVariant !== nextVariant) {
    for (const [key, value] of Object.entries(nextFill)) {
      if (value !== undefined) {
        result[key] = value
      }
    }
    return result
  }

  for (const [key, value] of Object.entries(nextFill)) {
    if (!ALL_FILL_VARIANT_KEYS.has(key) && value !== undefined) {
      result[key] = value
    }
  }

  if (prevVariant === 'pattern') {
    result.pattern = mergeLeaves(prevFill.pattern, nextFill.pattern)
  } else if (prevVariant === 'blip') {
    result.blip = mergeLeaves(prevFill.blip, nextFill.blip)
  } else if (prevVariant === 'gradient') {
    if (nextFill.gradient !== undefined) {
      result.gradient = nextFill.gradient
      if (nextFill.gradientPatch !== undefined) {
        result.gradientPatch = mergeLeaves(undefined, nextFill.gradientPatch)
      }
    } else {
      if (prevFill.gradient !== undefined) {
        result.gradient = prevFill.gradient
      }
      if (prevFill.gradientPatch !== undefined || nextFill.gradientPatch !== undefined) {
        result.gradientPatch = mergeLeaves(prevFill.gradientPatch, nextFill.gradientPatch)
      }
    }
  } else if (prevVariant === 'color') {
    result.color = nextFill.color !== undefined ? nextFill.color : prevFill.color
  } else {
    for (const [key, value] of Object.entries(nextFill)) {
      if (value !== undefined) {
        result[key] = value
      }
    }
  }
  return result
}

function mergeOverrideValues(target, sourceValues) {
  if (!sourceValues) return target
  const result = { ...target }
  if (sourceValues.label !== undefined) {
    result.label = sourceValues.label
  }
  if (sourceValues.textStyle !== undefined) {
    result.textStyle = { ...(result.textStyle || {}), ...sourceValues.textStyle }
  }
  if (sourceValues.geometryStyle !== undefined) {
    const prevGeom = result.geometryStyle || {}
    const nextGeom = sourceValues.geometryStyle || {}
    result.geometryStyle = {
      ...prevGeom,
      ...nextGeom,
      ...(prevGeom.stroke || nextGeom.stroke
        ? { stroke: { ...(prevGeom.stroke || {}), ...(nextGeom.stroke || {}) } }
        : {}),
      ...(prevGeom.fill || nextGeom.fill
        ? { fill: mergeFill(prevGeom.fill, nextGeom.fill) }
        : {}),
    }
  }
  return result
}
function findInheritanceOverride(document, instance) {
  if (!document || !instance) return null
  const overrides = []
  for (const [, style] of semanticStyles(document, { kind: 'inheritance-override' })) {
    if (style?.origin === 'project' && style.baseDefinitionId) overrides.push(style)
  }
  if (!overrides.length) return null
  const overridesByBaseDef = new Map(overrides.map((s) => [s.baseDefinitionId, s]))

  const context = textContext(document, instance)
  const masterDefId = context?.bindings?.masterDefinitionId
  const layoutDefId = context?.bindings?.layoutDefinitionId

  const ancestorDefIds = []
  let def = semanticDefinition(document, instance.definitionId)
  const visited = new Set([instance.definitionId])
  while (def?.parentDefinitionId) {
    if (visited.has(def.parentDefinitionId) || visited.size > 256) break
    visited.add(def.parentDefinitionId)
    ancestorDefIds.unshift(def.parentDefinitionId)
    def = semanticDefinition(document, def.parentDefinitionId)
  }

  const geometry = semanticStyle(document, instance.sourceBinding?.contextId)?.payload
  const geomDefIds = [...(geometry?.declarationIds ?? []), ...(geometry?.transformDeclarationIds ?? [])]
    .map((id) => semanticStyle(document, id)?.payload?.definitionId)
    .filter(Boolean)
  const geomFarToNear = [...geomDefIds].reverse()

  const ordered = [
    masterDefId,
    layoutDefId,
    ...geomFarToNear,
    ...ancestorDefIds,
    instance.definitionId,
  ].filter(Boolean)

  const seen = new Set()
  const uniqueFarToNear = []
  for (let i = ordered.length - 1; i >= 0; i--) {
    const id = ordered[i]
    if (!seen.has(id)) {
      seen.add(id)
      uniqueFarToNear.unshift(id)
    }
  }

  let mergedValues = null
  for (const defId of uniqueFarToNear) {
    const override = overridesByBaseDef.get(defId)
    if (override?.values) {
      mergedValues = mergeOverrideValues(mergedValues || {}, override.values)
    }
  }

  if (!mergedValues) return null
  const values = structuredClone(mergedValues)
  const patchProvider = values?.geometryStyle?.fill?.gradientPatch?.stops?.provider
  if (patchProvider && typeof patchProvider === 'object' && patchProvider.instanceId) {
    patchProvider.instanceId = instance.id
  }
  return {
    kind: 'inheritance-override',
    origin: 'project',
    values,
  }
}
function inheritanceTargets(presentation, operation) {
  const document = presentation.pptxSemantic
  const selected = semanticInstance(document, operation.instanceId)
  if (!selected || selected.lineage?.tombstone || selected.lineage?.paintOnly) fail('unavailable occurrence')
  const source = operation.sourceDefinitionId ?? selected.definitionId
  if (!semanticDefinition(document, source) || !dependsOn(document, selected, source)) fail('foreign source definition')
  if (operation.command.type === 'theme-colors') {
    if (operation.scope !== 'all') fail('theme changes require explicit all-occurrences scope')
    const theme = semanticStyle(document, operation.command.baseStyleId)
    if (theme?.kind !== 'theme' || theme.origin !== 'source') fail('unknown source theme')
    const affected = [...semanticInstances(document)].map(([, instance]) => instance).filter((instance) => {
      if (instance.lineage?.tombstone || instance.lineage?.paintOnly) return false
      const geometry = semanticStyle(document, instance.sourceBinding?.contextId)?.payload
      const context = textContext(document, instance)
      return geometry?.themeId === operation.command.baseStyleId ||
        context?.relationships.at(-1)?.targetPartUri === theme.source.partUri
    })
    if (!affected.some((instance) => instance.id === selected.id)) fail('selected occurrence is not linked to theme')
    return affected
  }
  if (operation.command.type === 'owner-override') {
    if (operation.scope !== 'all') fail('owner changes require explicit all-occurrences scope')
    const baseDefId = operation.command.baseDefinitionId ?? operation.sourceDefinitionId
    const baseDef = semanticDefinition(document, baseDefId)
    if (!baseDef || baseDef.origin === 'project' || (baseDef.origin !== undefined && baseDef.origin !== 'source')) fail('unknown source definition')
    const affected = [...semanticInstances(document)].map(([, instance]) => instance).filter((instance) => {
      if (instance.lineage?.tombstone || instance.lineage?.paintOnly) return false
      return dependsOn(document, instance, baseDefId)
    })
    if (!affected.some((instance) => instance.id === selected.id)) fail('selected occurrence is not linked to owner')
    return affected
  }
  return operation.scope === 'all'
    ? [...semanticInstances(document)].map(([, instance]) => instance).filter((instance) =>
      !instance.lineage?.tombstone && !instance.lineage?.paintOnly && dependsOn(document, instance, source))
    : [selected]
}
function targetRecords(presentation, instances) {
  const wanted = new Map(instances.map((instance) => [instance.id, instance]))
  const records = []
  function visit(slides, ancestorLocked = false) {
    for (const slide of slides) {
      const locked = !!(ancestorLocked || slide.locked)
      for (const element of slide.elements || []) {
        const instance = wanted.get(element.pptxInstanceId)
        if (!instance) continue
        let blocked = locked || !!element.locked
        let parent = instance
        while (parent) {
          blocked ||= !!parent.overrides.locked
          parent = semanticInstance(presentation.pptxSemantic, parent.parentInstanceId)
        }
        records.push({ instanceId: instance.id, slideId: slide.id, slideTitle: slide.title ?? '',
          elementId: element.id, locked: blocked })
      }
      visit(slide.children || [], locked)
    }
  }
  visit(presentation.slides)
  if (records.length !== instances.length || new Set(records.map((r) => r.instanceId)).size !== records.length)
    fail('missing or ambiguous projected occurrence')
  return records.sort((a, b) => a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0)
}
function previewNormalized(presentation, operation) {
  const instances = inheritanceTargets(presentation, operation)
  const occurrences = targetRecords(presentation, instances)
  const revision = JSON.stringify({ command: operation.command,
    sourceDefinitionId: operation.sourceDefinitionId ?? null,
    occurrences, instances, styles: presentation.pptxSemantic.styles,
    definitions: instances.map((i) => semanticDefinition(presentation.pptxSemantic, i.definitionId)) })
  return { occurrences, revision }
}
module.exports = {
  fail,
  textContext,
  dependsOn,
  findInheritanceOverride,
  inheritanceTargets,
  previewNormalized,
  mergeFill,
  mergeOverrideValues,
}
