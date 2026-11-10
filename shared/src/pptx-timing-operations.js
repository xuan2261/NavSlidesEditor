const { cloneTextData } = require('./pptx-text-document')
const { fail, record, sameLocator, TRIGGERS } = require('./pptx-timing-source')
const { sourceInventory, resolveSlideTiming, activeTarget, normalizeSourceTiming } = require('./pptx-timing-document')
const { semanticInstance, semanticDefinition } = require('./pptx-semantic-records')
const TIMING_EDIT = 'timing.edit'

function assertUnlockedTarget(document, slide, instanceId) {
  let instance = semanticInstance(document, instanceId)
  const seen = new Set()
  while (instance) {
    if (seen.has(instance.id)) fail('cyclic target ancestry')
    seen.add(instance.id)
    if (instance.overrides.locked) fail('locked target')
    instance = semanticInstance(document, instance.parentInstanceId)
  }
  if ((slide.elements || []).some(element => element.pptxInstanceId === instanceId && element.locked)) fail('locked target')
}
function editSourceTiming(document, slide, input) {
  const operation = cloneTextData(input)
  record(operation, ['type', 'slideId', 'definitionId', 'nodeLocator', 'command'])
  if (operation.type !== TIMING_EDIT || operation.slideId !== slide.id) fail('operation envelope')
  const inventory = sourceInventory(document, slide)
  const source = inventory.nodes.find(node => node.definitionId === operation.definitionId && sameLocator(node.nodeLocator, operation.nodeLocator))
  record(operation.nodeLocator, ['path', 'preconditionHash'])
  if (!source) fail('unsupported or foreign source node')
  const command = operation.command
  const valueField = { 'set-target': 'targetInstanceId', 'set-order': 'order', 'set-trigger': 'trigger',
    'set-duration': 'durationMs', 'set-delay': 'delayMs' }[command?.type]
  if (command?.type === 'reset') record(command, ['type'])
  else if (valueField) record(command, ['type', valueField])
  else fail('unsupported command')
  if (command.type === 'set-trigger' && !TRIGGERS.includes(command.trigger)) fail('trigger')
  if (command.type === 'set-order' && (!Number.isSafeInteger(command.order) || command.order < 1 || command.order > inventory.nodes.length)) fail('order')
  if (['durationMs', 'delayMs'].includes(valueField) &&
      (!Number.isSafeInteger(command[valueField]) || command[valueField] < 0)) fail(valueField)
  if (command.type === 'set-target') {
    if (!activeTarget(document, slide, command.targetInstanceId, semanticDefinition(document, source.definitionId).source.partUri)) fail('missing or foreign target')
    assertUnlockedTarget(document, slide, command.targetInstanceId)
  }
  const current = resolveSlideTiming(document, slide)
  const row = current.nodes.find(node => node.definitionId === source.definitionId && sameLocator(node.nodeLocator, source.nodeLocator))
  if (row.targetInstanceId) assertUnlockedTarget(document, slide, row.targetInstanceId)
  const previous = normalizeSourceTiming(document, slide)?.overrides || []
  const overrides = previous.map(entry => ({ ...entry }))
  const matches = entry => entry.definitionId === source.definitionId && sameLocator(entry.nodeLocator, source.nodeLocator)
  const at = overrides.findIndex(matches)
  const patch = at < 0 ? { definitionId: source.definitionId, nodeLocator: source.nodeLocator } : overrides[at]
  if (at < 0) overrides.push(patch)
  if (command.type === 'reset') {
    delete patch.targetInstanceId
    delete patch.trigger
    delete patch.durationMs
    delete patch.delayMs
  } else if (command.type !== 'set-order') patch[valueField] = command[valueField]
  if (['set-order', 'reset'].includes(command.type)) {
    const reordered = [...current.nodes]
    reordered.splice(reordered.indexOf(row), 1)
    reordered.splice((command.type === 'reset' ? source.order : command.order) - 1, 0, row)
    reordered.forEach((node, index) => {
      const baseline = inventory.nodes.find(entry => entry.definitionId === node.definitionId && sameLocator(entry.nodeLocator, node.nodeLocator))
      let entry = overrides.find(entry => entry.definitionId === node.definitionId && sameLocator(entry.nodeLocator, node.nodeLocator))
      if (index + 1 === baseline.order) { if (entry) delete entry.order; return }
      if (!entry) { entry = { definitionId: node.definitionId, nodeLocator: node.nodeLocator }; overrides.push(entry) }
      entry.order = index + 1
    })
  }
  // A trigger delta may equal the source value: authoring it deliberately
  // detaches the node from its original concurrent event-group schedule.
  const sourceTiming = { schemaVersion: 1, overrides: overrides.filter(entry => Object.keys(entry).length > 2) }
  const next = { ...slide, sourceTiming }
  normalizeSourceTiming(document, next)
  const resolved = resolveSlideTiming(document, next)
  const changedFields = ['targetInstanceId', 'order', 'trigger', 'durationMs', 'delayMs', 'orderOverridden', 'triggerOverridden', 'status', 'reason']
  for (const node of resolved.nodes) {
    const before = current.nodes.find(previous => previous.definitionId === node.definitionId && sameLocator(previous.nodeLocator, node.nodeLocator))
    if (!changedFields.some(field => before[field] !== node[field])) continue
    for (const target of new Set([before.targetInstanceId, node.targetInstanceId]))
      if (target) assertUnlockedTarget(document, slide, target)
  }
  return next
}
function applyTimingPresentationOperation(input, intent) {
  const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation')
  const operation = cloneTextData(intent)
  const presentation = normalizeSemanticPresentation(input)
  let count = 0
  const visit = (slides, ancestorLocked = false) => slides.map(slide => {
    const locked = ancestorLocked || slide.locked
    let next = slide
    if (slide.id === operation.slideId) {
      if (++count > 1 || locked) fail('locked or ambiguous slide')
      next = editSourceTiming(presentation.pptxSemantic, slide, operation)
    }
    return slide.children ? { ...next, children: visit(slide.children, locked) } : next
  })
  const slides = visit(presentation.slides)
  if (count !== 1) fail('missing slide')
  return normalizeSemanticPresentation({ ...presentation, slides })
}
module.exports = { TIMING_EDIT, editSourceTiming, applyTimingPresentationOperation }
