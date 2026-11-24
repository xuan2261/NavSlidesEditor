const { fail, record, sameLocator, TRIGGERS, validateTimingDefinition } = require('./pptx-timing-source')
const { inspectTimingDefinition } = require('./pptx-timing-inspection')
const { cloneTextData } = require('./pptx-text-document')
const {
  semanticDefinition,
  semanticDefinitions,
  semanticInstance,
  semanticInstances,
} = require('./pptx-semantic-records.js')

function timingDefinitions(document, slide) {
  const sources = (document.sourceSlides || []).filter(entry => entry.slideId === slide.id)
  const parts = new Set(sources.map(entry => entry.partUri))
  const original = []
  for (const [, definition] of semanticDefinitions(document)) {
    if (definition?.content?.timingDocument && parts.has(definition.source?.partUri)) {
      original.push(definition)
    }
  }
  if (slide.sourceTimingDefinitionIds === undefined) return original
  // Projection ownership for whole-slide clones, never inferred from pasted elements.
  const ids = cloneTextData(slide.sourceTimingDefinitionIds)
  const defCount = document.schemaVersion === 2
    ? Object.keys(document.definitions).length
    : (Array.isArray(document.definitions) ? document.definitions.length : Object.keys(document.definitions).length)
  if (!Array.isArray(ids) || ids.length > defCount ||
      new Set(ids).size !== ids.length) fail('timing ownership inventory')
  const definitions = ids.map(id => {
    const definition = typeof id === 'string' && id.length > 0 && id.length <= 1024 && semanticDefinition(document, id)
    if (!definition?.content.timingDocument) fail('timing ownership reference')
    validateTimingDefinition(definition)
    return definition
  })
  if (sources.length && JSON.stringify(ids) !== JSON.stringify(original.map(definition => definition.id)))
    fail('original timing ownership changed')
  return definitions
}
function sourceInventory(document, slide) {
  const nodes = [], unsupported = []
  for (const definition of timingDefinitions(document, slide)) {
    const result = inspectTimingDefinition(definition)
    nodes.push(...result.nodes)
    unsupported.push(...result.unsupported)
  }
  return { nodes: nodes.map((node, index) => ({ ...node, order: index + 1 })), unsupported }
}
function activeTarget(document, slide, instanceId, partUri) {
  const instance = semanticInstance(document, instanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  if (!instance || instance.slideId !== slide.id || instance.lineage?.tombstone || instance.lineage?.paintOnly ||
      definition?.source?.partUri !== partUri || !definition?.source?.nativeId || ['group', 'opaque'].includes(definition.kind) ||
      (slide.elements || []).filter(element => element.pptxInstanceId === instanceId).length !== 1) return false
  let ancestor = instance
  const seen = new Set()
  while (ancestor) {
    if (seen.has(ancestor.id) || ancestor.lineage?.tombstone || ancestor.lineage?.paintOnly) return false
    seen.add(ancestor.id)
    const parentId = ancestor.parentInstanceId
    ancestor = semanticInstance(document, parentId)
    if (parentId != null && !ancestor) return false
  }
  return true
}
function resolveSourceTarget(document, slide, definition, sourceTarget) {
  const candidates = []
  for (const [, instance] of semanticInstances(document)) {
    if (semanticDefinition(document, instance.definitionId)?.source?.nativeId === sourceTarget.spid &&
        activeTarget(document, slide, instance.id, definition.source.partUri)) {
      candidates.push(instance)
    }
  }
  if (candidates.length !== 1) return { status: 'unresolved', reason: candidates.length ? 'ambiguous-target' : 'missing-target' }
  return { status: 'ready', targetInstanceId: candidates[0].id }
}
function normalizeSourceTiming(document, slide) {
  if (slide.sourceTiming === undefined) return undefined
  const sourceTiming = cloneTextData(slide.sourceTiming)
  record(sourceTiming, ['schemaVersion', 'overrides'])
  if (sourceTiming.schemaVersion !== 1 || !Array.isArray(sourceTiming.overrides)) fail('overlay schema')
  const inventory = sourceInventory(document, slide), seen = new Set()
  const overrides = sourceTiming.overrides.map(override => {
    record(override, ['definitionId', 'nodeLocator', 'targetInstanceId', 'order', 'trigger', 'durationMs', 'delayMs'], ['definitionId', 'nodeLocator'])
    record(override.nodeLocator, ['path', 'preconditionHash'])
    const node = inventory.nodes.find(node => node.definitionId === override.definitionId && sameLocator(node.nodeLocator, override.nodeLocator))
    const key = JSON.stringify([override.definitionId, override.nodeLocator])
    if (!node || seen.has(key) || Object.keys(override).length === 2) fail('unknown, duplicate or empty node override')
    seen.add(key)
    if (Object.hasOwn(override, 'targetInstanceId')) {
      if (typeof override.targetInstanceId !== 'string' || !override.targetInstanceId.length || override.targetInstanceId.length > 1024) fail('target identity')
      const target = semanticInstance(document, override.targetInstanceId)
      const targetDefinition = target && semanticDefinition(document, target.definitionId)
      // Tombstoned/missing targets stay persisted so reopen can disclose rather than
      // discard an authored reference. Existing foreign identities are never valid.
      if (target && (target.slideId !== slide.id || !targetDefinition?.source?.nativeId ||
          ['group', 'opaque'].includes(targetDefinition.kind) || targetDefinition.source.partUri !==
          semanticDefinition(document, node.definitionId)?.source.partUri)) fail('foreign or unsupported timing target')
    }
    if (Object.hasOwn(override, 'order') && (!Number.isSafeInteger(override.order) || override.order < 1 || override.order > inventory.nodes.length)) fail('order')
    if (Object.hasOwn(override, 'trigger') && !TRIGGERS.includes(override.trigger)) fail('trigger')
    for (const field of ['durationMs', 'delayMs'])
      if (Object.hasOwn(override, field) && (!Number.isSafeInteger(override[field]) || override[field] < 0)) fail(field)
    return { ...override, nodeLocator: { path: [...override.nodeLocator.path], preconditionHash: override.nodeLocator.preconditionHash } }
  })
  const orders = inventory.nodes.map(node => overrides.find(override => override.definitionId === node.definitionId && sameLocator(override.nodeLocator, node.nodeLocator))?.order ?? node.order)
  if (new Set(orders).size !== orders.length) fail('ambiguous timing order')
  return { schemaVersion: 1, overrides }
}
function resolveSlideTiming(document, slide) {
  const inventory = sourceInventory(document, slide)
  const overlay = normalizeSourceTiming(document, slide)
  const nodes = inventory.nodes.map(node => {
    const definition = semanticDefinition(document, node.definitionId)
    const override = overlay?.overrides.find(entry => entry.definitionId === node.definitionId && sameLocator(entry.nodeLocator, node.nodeLocator))
    const target = override?.targetInstanceId !== undefined
      ? activeTarget(document, slide, override.targetInstanceId, definition.source.partUri)
        ? { status: 'ready', targetInstanceId: override.targetInstanceId }
        : { status: 'unresolved', targetInstanceId: override.targetInstanceId, reason: 'missing-target' }
      : resolveSourceTarget(document, slide, definition, node.sourceTarget)
    return { ...node, ...target, order: override?.order ?? node.order, trigger: override?.trigger ?? node.trigger,
      durationMs: override?.durationMs ?? node.durationMs, delayMs: override?.delayMs ?? node.delayMs,
      triggerOverridden: Object.hasOwn(override || {}, 'trigger'), orderOverridden: Object.hasOwn(override || {}, 'order') }
  }).sort((a, b) => a.order - b.order)
  for (const node of nodes) {
    if (!node.groupedWithPrevious || node.triggerOverridden || node.orderOverridden) continue
    const anchor = nodes.find(candidate => candidate.definitionId === node.definitionId && !candidate.groupedWithPrevious &&
      sameLocator(candidate.sourceGroupLocator, node.sourceGroupLocator))
    if (!anchor || anchor.status !== 'ready') { node.status = 'unresolved'; node.reason = 'missing-group-target' }
    else if (anchor.triggerOverridden || anchor.orderOverridden) { node.status = 'unresolved'; node.reason = 'source-group-detached' }
  }
  return { nodes, unsupported: inventory.unsupported }
}
// Internal identity maintenance: preserve an already-resolved original binding
// when same-slide paste adds another occurrence with the same native source ID.
// This does not offer an unlocked authoring path: the only allowed target is the
// exact prior occurrence, still present with its original source definition.
function pinDuplicatedTimingTargets(document, slide, nextDocument, nextSlide) {
  if (slide.id !== nextSlide.id) fail('paste changed slide identity')
  const before = resolveSlideTiming(document, slide), after = resolveSlideTiming(nextDocument, nextSlide)
  const overrides = (normalizeSourceTiming(nextDocument, nextSlide)?.overrides || []).map(entry => ({ ...entry }))
  let changed = false
  for (const node of before.nodes.filter(node => node.targetInstanceId &&
    activeTarget(document, slide, node.targetInstanceId, semanticDefinition(document, node.definitionId)?.source.partUri))) {
    const next = after.nodes.find(candidate => candidate.definitionId === node.definitionId && sameLocator(candidate.nodeLocator, node.nodeLocator))
    if (!next || next.targetInstanceId === node.targetInstanceId) continue
    const original = semanticInstance(document, node.targetInstanceId), retained = semanticInstance(nextDocument, node.targetInstanceId)
    const partUri = semanticDefinition(document, node.definitionId)?.source.partUri
    if (!retained || retained.definitionId !== original.definitionId || !activeTarget(nextDocument, nextSlide, retained.id, partUri))
      fail('paste removed original timing target')
    let override = overrides.find(entry => entry.definitionId === node.definitionId && sameLocator(entry.nodeLocator, node.nodeLocator))
    if (!override) { override = { definitionId: node.definitionId, nodeLocator: node.nodeLocator }; overrides.push(override) }
    override.targetInstanceId = node.targetInstanceId
    changed = true
  }
  if (!changed) return nextSlide
  const result = { ...nextSlide, sourceTiming: { schemaVersion: 1, overrides } }
  normalizeSourceTiming(nextDocument, result)
  return result
}
module.exports = { validateTimingDefinition, inspectTimingDefinition, normalizeSourceTiming, resolveSlideTiming,
  resolveSourceTarget, activeTarget, sourceInventory, timingDefinitions, TRIGGERS, pinDuplicatedTimingTargets }
