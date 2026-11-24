import groups from 'revealjs-shared/src/pptx-semantic-groups.js'
import semanticDocument from 'revealjs-shared/src/pptx-semantic-document.js'
import connectors from 'revealjs-shared/src/pptx-semantic-connectors.js'
import { semanticInstance, semanticDefinition, semanticInstances, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

export function semanticSelection(document, slide, ids) {
  return ids
    .map((id) => slide.elements?.find((e) => e.id === id)?.pptxInstanceId || id)
    .filter((id) => {
      const inst = semanticInstance(document, id)
      return (
        inst?.slideId === slide.id &&
        !inst.lineage?.tombstone &&
        !inst.lineage?.paintOnly
      )
    })
}

export function semanticDeletion(document, slide, ids) {
  const normalized = semanticDocument.normalizePptxSemanticDocument(document)
  const selected = new Set(semanticSelection(normalized, slide, ids))
  const removed = new Set(selected)
  for (const [, instance] of semanticInstances(normalized)) {
    let parent = instance.parentInstanceId
    while (parent !== null && parent !== undefined) {
      if (selected.has(parent)) {
        removed.add(instance.id)
        break
      }
      parent = semanticInstance(normalized, parent)?.parentInstanceId
    }
  }
  const detached = connectors.detachConnectorBindingsFromTargets(normalized, removed)
  const patchInstances = {}
  for (const id of removed) {
    const inst = semanticInstance(detached, id)
    patchInstances[id] = {
      ...inst,
      lineage: {
        ...inst.lineage,
        tombstone: true,
        deleted: true,
        ...(inst.lineage?.paintOnly ? { paintOnly: false } : {}),
      },
    }
  }
  const elementIds = [
    ...new Set([
      ...ids,
      ...(slide.elements || [])
        .filter((element) => removed.has(element.pptxInstanceId))
        .map((element) => element.id),
    ]),
  ]
  return {
    document: semanticDocument.normalizePptxSemanticDocument(replaceSemanticRecords(detached, { instances: patchInstances })),
    elementIds,
  }
}

export function groupSemanticSelection(document, ids, groupId) {
  const children = ids.map((id) => semanticInstance(document, id))
  const parent = children[0]?.parentInstanceId
  if (
    children.length < 2 ||
    children.some(
      (child) => !child || child.parentInstanceId !== parent || child.slideId !== children[0].slideId
    )
  )
    throw new TypeError('Semantic grouping requires siblings on one slide')
  const definitionId = `${groupId}:definition`
  const groupDefinition = {
    id: definitionId,
    origin: 'project',
    kind: 'group',
    source: null,
    components: [],
    content: {},
  }
  const groupInstance = {
    id: groupId,
    definitionId,
    slideId: children[0].slideId,
    parentInstanceId: parent,
    localTransform: [1, 0, 0, 1, 0, 0],
    paintIndex: Math.min(...children.map((child) => child.paintIndex)),
    overrides: {},
  }
  const patchInstances = {
    [groupId]: groupInstance,
  }
  for (const child of children) patchInstances[child.id] = { ...child, parentInstanceId: groupId }
  const nextDoc = replaceSemanticRecords(document, {
    definitions: { [definitionId]: groupDefinition },
    instances: patchInstances,
  })
  return semanticDocument.normalizePptxSemanticDocument(nextDoc)
}

export function ungroupSemanticSelection(document, ids) {
  let next = document
  for (const id of ids) {
    const inst = semanticInstance(next, id)
    if (semanticDefinition(next, inst?.definitionId)?.kind === 'group') {
      const group = inst
      const content = semanticDefinition(next, group.definitionId).content
      const hidden = group.overrides.hidden ?? group.hidden ?? content.hidden ?? false
      const childIds = []
      for (const [, child] of semanticInstances(next)) {
        if (child.parentInstanceId === id && !child.lineage?.tombstone) {
          childIds.push(child.id)
        }
      }
      const previous = next
      next = groups.ungroupSemanticInstance(next, id)
      const patchInstances = {}
      const ungroupedInstance = semanticInstance(next, id)
      const materializeHidden = hidden && !ungroupedInstance?.lineage?.paintOnly
      for (const childId of childIds) {
        const child = semanticInstance(previous, childId)
        const currentChild = semanticInstance(next, childId)
        patchInstances[childId] = {
          ...currentChild,
          overrides: materializeHidden
            ? { ...child.overrides, hidden: true }
            : currentChild.overrides,
          lineage: {
            ...currentChild.lineage,
            ungroupedFrom: id,
            ...(materializeHidden
              ? {
                  ungroupHidden: {
                    groupId: id,
                    hadOverride: Object.hasOwn(child.overrides, 'hidden'),
                    hidden: child.overrides.hidden ?? false,
                  },
                }
              : {}),
          },
        }
      }
      next = replaceSemanticRecords(next, { instances: patchInstances })
      next = semanticDocument.normalizePptxSemanticDocument(next)
    }
  }
  return next
}

export function regroupSemanticSelection(document, ids) {
  let groupId
  for (const [, instance] of semanticInstances(document)) {
    if (
      (instance.lineage?.tombstone || instance.lineage?.paintOnly) &&
      ids.every((id) => semanticInstance(document, id)?.lineage?.ungroupedFrom === instance.id)
    ) {
      groupId = instance.id
      break
    }
  }
  if (!groupId) return null
  let next = groups.regroupSemanticInstance(document, groupId, ids)
  const patchInstances = {}
  for (const id of ids) {
    const child = semanticInstance(next, id)
    const inherited = child?.lineage?.ungroupHidden
    if (inherited?.groupId !== groupId || child?.overrides?.hidden !== true) continue
    const overrides = { ...child.overrides }
    if (inherited.hadOverride) overrides.hidden = inherited.hidden
    else delete overrides.hidden
    patchInstances[id] = { ...child, overrides }
  }
  next = replaceSemanticRecords(next, { instances: patchInstances })
  next = semanticDocument.normalizePptxSemanticDocument(next)
  return { groupId, document: next }
}
