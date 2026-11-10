const { normalizePptxSemanticDocument } = require('./pptx-semantic-document.js')
const {
  semanticDefinition,
  semanticInstance,
  semanticInstances,
  semanticStyle,
  replaceSemanticRecords,
} = require('./pptx-semantic-records.js')

const { IDENTITY, multiply, invert, transformPoint } = require('./pptx-affine.js')
const { semanticGroupPaint } = require('./pptx-semantic-paint.js')

function activeInstance(document, id) {
  const instance = semanticInstance(document, id) ?? document.instances?.[id]
  if (!instance || instance.lineage?.tombstone === true)
    throw new TypeError('Unknown active semantic instance')
  return instance
}
function world(document, id) {
  const ancestry = []
  while (id !== null) {
    const instance = activeInstance(document, id)
    ancestry.push(instance.localTransform)
    id = instance.parentInstanceId
  }
  return ancestry.reverse().reduce((matrix, local) => multiply(matrix, local), IDENTITY)
}
function instanceWorldTransform(input, id) {
  return world(normalizePptxSemanticDocument(input), id)
}
function createSemanticInstanceReader(input) {
  const document = normalizePptxSemanticDocument(input)
  return Object.freeze({
    document,
    instanceWorldTransform: (id) => world(document, id),
    semanticInstanceTree: (slideId) => instanceTree(document, slideId),
  })
}
function parentDelta(document, instance, delta) {
  const inverse = invert(world(document, instance.parentInstanceId))
  // Vectors have no translation. Subtracting two inverse points would introduce
  // cancellation from potentially large native source offsets.
  return transformPoint([inverse[0], inverse[1], inverse[2], inverse[3], 0, 0], delta)
}
function pointerDeltaInParent(input, id, delta) {
  const document = normalizePptxSemanticDocument(input)
  return parentDelta(document, activeInstance(document, id), delta)
}
function moveSemanticInstance(input, id, delta) {
  const document = normalizePptxSemanticDocument(input)
  const instance = activeInstance(document, id)
  if (instance.lineage?.paintOnly) throw new TypeError('Paint scope is not an authoring target')
  const localDelta = parentDelta(document, instance, delta)
  const localTransform = [...instance.localTransform]
  localTransform[4] += localDelta.x
  localTransform[5] += localDelta.y
  return replaceSemanticRecords(document, {
    instances: {
      [id]: { ...instance, localTransform },
    },
  })
}
function transformSemanticInstance(input, id, operation) {
  const document = normalizePptxSemanticDocument(input)
  const instance = activeInstance(document, id)
  if (instance.lineage?.paintOnly) throw new TypeError('Paint scope is not an authoring target')
  invert(operation)
  const parent = world(document, instance.parentInstanceId)
  const localTransform = multiply(
    multiply(multiply(invert(parent), operation), parent),
    instance.localTransform
  )
  return replaceSemanticRecords(document, {
    instances: { [id]: { ...instance, localTransform } },
  })
}
function groupHasFillScope(document, group, _groupStyle) {
  if (group.overrides.fill) return true
  const queue = [group.id]
  while (queue.length > 0) {
    const parentId = queue.shift()
    for (const [, inst] of semanticInstances(document)) {
      if (!inst.lineage?.tombstone && inst.parentInstanceId === parentId) {
        const childStyle = inst.sourceBinding?.contextId
          ? (semanticStyle(document, inst.sourceBinding.contextId) ?? document.styles?.[inst.sourceBinding.contextId])
          : null
        for (const dId of childStyle?.payload?.declarationIds || []) {
          const d = semanticStyle(document, dId) ?? document.styles?.[dId]
          if (d?.payload?.properties?.fill?.value?.group === true) return true
        }
        queue.push(inst.id)
      }
    }
  }
  return false
}

function ungroupSemanticInstance(input, id) {
  const document = normalizePptxSemanticDocument(input)
  const group = activeInstance(document, id)
  const groupDef = semanticDefinition(document, group.definitionId) ?? document.definitions?.[group.definitionId]
  if (groupDef?.kind !== 'group')
    throw new TypeError('Ungroup requires a semantic group')
  if (group.lineage?.paintOnly) throw new TypeError('Group is already ungrouped for authoring')
  const groupStyle = group.sourceBinding?.contextId
    ? (semanticStyle(document, group.sourceBinding.contextId) ?? document.styles?.[group.sourceBinding.contextId])
    : null
  if (
    semanticGroupPaint(groupDef, group).composite ||
    groupHasFillScope(document, group, groupStyle)
  ) {
    return replaceSemanticRecords(document, {
      instances: {
        [id]: {
          ...group,
          lineage: { ...group.lineage, paintOnly: true },
        },
      },
    })
  }
  const patch = {}
  for (const [key, child] of semanticInstances(document)) {
    if (child.parentInstanceId !== id || child.lineage?.tombstone === true) continue
    patch[key] = {
      ...child,
      parentInstanceId: group.parentInstanceId,
      localTransform: multiply(group.localTransform, child.localTransform),
    }
  }
  patch[id] = { ...group, lineage: { ...group.lineage, tombstone: true } }
  return replaceSemanticRecords(document, { instances: patch })
}
function regroupSemanticInstance(input, id, childIds) {
  const document = normalizePptxSemanticDocument(input)
  const group = semanticInstance(document, id) ?? document.instances?.[id]
  const groupDef = group
    ? (semanticDefinition(document, group.definitionId) ?? document.definitions?.[group.definitionId])
    : null
  if (
    !group ||
    groupDef?.kind !== 'group' ||
    (group.lineage?.tombstone !== true && group.lineage?.paintOnly !== true)
  )
    throw new TypeError('Regroup requires a tombstoned semantic group')
  if (!Array.isArray(childIds) || !childIds.length || new Set(childIds).size !== childIds.length)
    throw new TypeError('Invalid regroup selection')
  if (group.lineage?.paintOnly === true) {
    const children = []
    for (const [, child] of semanticInstances(document)) {
      if (child.parentInstanceId === id && child.lineage?.tombstone !== true) children.push(child)
    }
    if (
      children.length !== childIds.length ||
      children.some((child) => !childIds.includes(child.id))
    )
      throw new TypeError('Regroup paint scope requires all its active children')
    return replaceSemanticRecords(document, {
      instances: {
        [id]: {
          ...group,
          lineage: { ...group.lineage, paintOnly: false },
        },
      },
    })
  }
  if (group.parentInstanceId !== null) activeInstance(document, group.parentInstanceId)
  const patch = {}
  const inverse = invert(group.localTransform)
  for (const childId of childIds) {
    const child = activeInstance(document, childId)
    if (child.slideId !== group.slideId || child.parentInstanceId !== group.parentInstanceId)
      throw new TypeError('Regroup requires siblings in the same slide')
    patch[childId] = {
      ...child,
      parentInstanceId: id,
      localTransform: multiply(inverse, child.localTransform),
    }
  }
  patch[id] = { ...group, lineage: { ...group.lineage, tombstone: false } }
  return replaceSemanticRecords(document, { instances: patch })
}
function semanticInstanceTree(input, slideId) {
  return instanceTree(normalizePptxSemanticDocument(input), slideId)
}
function instanceTree(document, slideId) {
  const nodes = new Map()
  const parentIds = new Map()
  for (const [, instance] of semanticInstances(document)) {
    if (instance.slideId !== slideId || instance.lineage?.tombstone === true) continue
    const def = semanticDefinition(document, instance.definitionId) ?? document.definitions?.[instance.definitionId]
    nodes.set(instance.id, {
      instanceId: instance.id,
      definitionId: instance.definitionId,
      kind: def?.kind,
      localTransform: [...instance.localTransform],
      paintIndex: instance.paintIndex,
      children: [],
    })
    parentIds.set(instance.id, instance.parentInstanceId)
  }
  const roots = []
  for (const [id, node] of nodes) {
    const parentId = parentIds.get(id)
    if (parentId === null) roots.push(node)
    else {
      const parent = nodes.get(parentId)
      if (!parent) throw new TypeError('Active instance has an inactive parent')
      parent.children.push(node)
    }
  }
  function sort(nodes) {
    nodes.sort(
      (left, right) =>
        left.paintIndex - right.paintIndex ||
        (left.instanceId < right.instanceId ? -1 : left.instanceId > right.instanceId ? 1 : 0)
    )
    for (const node of nodes) sort(node.children)
  }
  sort(roots)
  return roots
}

module.exports = {
  createSemanticInstanceReader,
  instanceWorldTransform,
  pointerDeltaInParent,
  moveSemanticInstance,
  transformSemanticInstance,
  ungroupSemanticInstance,
  regroupSemanticInstance,
  semanticInstanceTree,
}
module.exports.default = module.exports
