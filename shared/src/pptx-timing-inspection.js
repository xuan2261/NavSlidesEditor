const { P, validateTimingDefinition, attributes, one, children, descendants } = require('./pptx-timing-source')
const BEHAVIORS = new Set(['set', 'animEffect', 'anim', 'animMotion', 'animScale', 'animRot', 'animClr', 'cmd', 'audio', 'video'])
const STRUCTURE = new Set(['timing', 'tnLst', 'par', 'seq', 'cTn', 'childTnLst', 'subTnLst', 'stCondLst', 'cond', 'tgtEl', 'sldTgt'])
const millis = value => /^(?:0|[1-9]\d*)$/.test(value ?? '') && Number.isSafeInteger(Number(value)) ? Number(value) : null
const fields = (node, names) => Object.keys(attributes(node)).every(key => names.includes(key))

function contextTiming(ancestors) {
  let trigger = 'withPrevious', delayMs = 0, sourceGroupLocator = null, eventGroups = 0
  for (const node of ancestors) {
    if (!P.has(node.namespace) || !STRUCTURE.has(node.name)) return null
    if (node.name === 'seq') return null
    const attrs = attributes(node)
    if (node.name !== 'cTn' && node.name !== 'cond' && Object.keys(attrs).length) return null
    if (node.name === 'cTn') {
      if (!/^[1-9]\d*$/.test(attrs.id ?? '') || !Number.isSafeInteger(Number(attrs.id))) return null
      if (sourceGroupLocator === null) sourceGroupLocator = node.locator
      if (!fields(node, ['id', 'dur', 'fill', 'nodeType', 'presetID', 'presetClass', 'presetSubtype']) ||
          (attrs.dur !== undefined && attrs.dur !== 'indefinite') ||
          (attrs.fill !== undefined && !['hold', 'freeze'].includes(attrs.fill)) ||
          (attrs.presetClass !== undefined && !['entr', 'exit'].includes(attrs.presetClass)) ||
          (attrs.presetSubtype !== undefined && attrs.presetSubtype !== '0') ||
          (attrs.nodeType !== undefined && !['tmRoot', 'mainSeq', 'clickEffect', 'withEffect', 'afterEffect'].includes(attrs.nodeType))) return null
      if (['clickEffect', 'withEffect', 'afterEffect'].includes(attrs.nodeType)) {
        if (++eventGroups > 1) return null
        if (attrs.nodeType === 'clickEffect' && delayMs) return null
        trigger = { clickEffect: 'onClick', withEffect: 'withPrevious', afterEffect: 'afterPrevious' }[attrs.nodeType]
        sourceGroupLocator = node.locator
      }
      const conditions = children(node, 'stCondLst')
      if (conditions.length > 1 || conditions.some(list => !fields(list, []) || list.children.length !== 1)) return null
      const condition = conditions[0] && one(conditions[0], 'cond')
      if (conditions.length && !condition) return null
      if (condition) {
        const conditionAttrs = attributes(condition)
        if (!fields(condition, ['delay', 'evt']) ||
            (conditionAttrs.evt !== undefined && conditionAttrs.evt !== 'onClick') ||
            (conditionAttrs.delay !== undefined && millis(conditionAttrs.delay) === null) ||
            condition.children.length > 1 ||
            condition.children.some(child => !P.has(child.namespace) || child.name !== 'tgtEl' || !fields(child, []) ||
              child.children.length !== 1 || !one(child, 'sldTgt') || !fields(one(child, 'sldTgt'), []) ||
              one(child, 'sldTgt').children.length)) return null
        if (conditionAttrs.evt === 'onClick') {
          if (delayMs) return null
          if (!['clickEffect', 'withEffect', 'afterEffect'].includes(attrs.nodeType) && ++eventGroups > 1) return null
          trigger = 'onClick'; sourceGroupLocator = node.locator
        }
        delayMs += Number(conditionAttrs.delay ?? 0)
      }
      if (node.children.some(child => !P.has(child.namespace) ||
          !['stCondLst', 'childTnLst', 'subTnLst'].includes(child.name))) return null
    }
  }
  return Number.isSafeInteger(delayMs) ? { trigger, delayMs, sourceGroupLocator } : null
}

function qualifyBehavior(node, ancestors, source, timing) {
  if (!timing) return { reason: 'unsupported-timing-context' }
  if (!ancestors.some(ancestor => ancestor.name === 'tnLst') ||
      !['childTnLst', 'subTnLst'].includes(ancestors.at(-1)?.name) ||
      !ancestors.some(ancestor => ancestor.name === 'cTn')) return { reason: 'unsupported-timing-context' }
  if (!['set', 'animEffect'].includes(node.name)) return { reason: 'unsupported-effect' }
  const behavior = one(node, 'cBhvr'), clock = behavior && one(behavior, 'cTn')
  const target = behavior && one(behavior, 'tgtEl'), shape = target && one(target, 'spTgt')
  const references = source.targetReferences.filter(entry =>
    JSON.stringify(entry.locator.path) === JSON.stringify(shape?.locator.path))
  if (!behavior || !clock || !target || !shape || references.length !== 1 ||
      !fields(shape, ['spid']) || shape.children.length || target.children.length !== 1 ||
      !fields(target, []) || !fields(behavior, []) ||
      !fields(clock, ['id', 'dur', 'fill']) || clock.children.length ||
      !/^[1-9]\d*$/.test(attributes(clock).id ?? '') || !Number.isSafeInteger(Number(attributes(clock).id)) ||
      (attributes(clock).fill !== undefined && !['hold', 'freeze'].includes(attributes(clock).fill)))
    return { reason: 'unsupported-target-or-behavior' }
  let effect, durationMs = millis(attributes(clock).dur)
  if (node.name === 'animEffect') {
    const attrs = attributes(node)
    if (!fields(node, ['filter', 'transition']) || attrs.filter !== 'fade' ||
        !['in', 'out'].includes(attrs.transition) || node.children.length !== 1 ||
        behavior.children.length !== 2 || durationMs === null) return { reason: 'unsupported-effect' }
    effect = attrs.transition === 'in' ? 'fade-in' : 'fade-out'
  } else {
    const names = one(behavior, 'attrNameLst'), name = names && one(names, 'attrName')
    const value = one(node, 'to'), visibility = value && one(value, 'strVal')
    if (!fields(node, []) || node.children.length !== 2 || behavior.children.length !== 3 ||
        !names || names.children.length !== 1 || !fields(names, []) || !name || !fields(name, []) ||
        name.children.length || name.text !== 'style.visibility' || !value || value.children.length !== 1 ||
        !fields(value, []) || !visibility || !fields(visibility, ['val']) || visibility.children.length ||
        !['visible', 'hidden'].includes(attributes(visibility).val) ||
        durationMs !== 1) return { reason: 'unsupported-effect' }
    durationMs = 0
    effect = attributes(visibility).val === 'visible' ? 'appear' : 'disappear'
  }
  return { ...timing, durationMs, effect, sourceTarget: references[0] }
}

function inspectTimingDefinition(definition) {
  validateTimingDefinition(definition)
  const source = definition.content.timingDocument
  if (!source) return { nodes: [], unsupported: [] }
  const nodes = [], unsupported = [], groups = new Set()
  let blocked = false, previousGroup = null
  const addUnsupported = (node, reason) => unsupported.push({ definitionId: definition.id,
    nodeLocator: node.locator, tag: node.name, reason })
  function visit(node, ancestors) {
    if (!P.has(node.namespace) || !STRUCTURE.has(node.name)) {
      if (P.has(node.namespace) && BEHAVIORS.has(node.name)) {
        const context = contextTiming(ancestors)
        const group = context?.sourceGroupLocator && JSON.stringify(context.sourceGroupLocator)
        const independent = context?.trigger === 'onClick' && group !== previousGroup
        previousGroup = group
        const result = qualifyBehavior(node, ancestors, source, context)
        if (result.reason) { addUnsupported(node, result.reason); blocked = true }
        else if (blocked && !independent) addUnsupported(node, 'unsupported-predecessor')
        else {
          blocked = false
          result.groupedWithPrevious = Boolean(group && groups.has(group))
          if (group && groups.has(group)) result.trigger = 'withPrevious'
          if (group) groups.add(group)
          nodes.push({ definitionId: definition.id, nodeLocator: node.locator,
            nativeTimeId: attributes(one(one(node, 'cBhvr'), 'cTn')).id ?? null,
            order: nodes.length + 1, ...result })
        }
      } else { addUnsupported(node, 'unsupported-timing-node'); blocked = true; previousGroup = null }
      return
    }
    for (const child of node.children) visit(child, [...ancestors, node])
  }
  visit(source.tree, [])
  if (!nodes.length && !unsupported.length) addUnsupported(source.tree, 'empty-timing-tree')
  // Duplicate native time-node IDs make source scheduling ambiguous, even if a
  // structural locator still distinguishes the authored XML nodes.
  const ids = descendants(source.tree).filter(node => P.has(node.namespace) && node.name === 'cTn')
    .map(node => attributes(node).id).filter(value => value !== undefined)
  if (new Set(ids).size !== ids.length) return { nodes: [], unsupported: [{ definitionId: definition.id,
    nodeLocator: source.tree.locator, tag: 'timing', reason: 'ambiguous-time-node-id' }] }
  return { nodes, unsupported }
}
module.exports = { inspectTimingDefinition }
