const { hashRecord } = require('./package-store/schemas')
const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const { deriveCanonicalPlainTextJournal } = require('./canonical-plain-text-journal')
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, createMatrixAuthoritySubject,
  featureMatrixHash,
} = require('./canonical-feature-matrix')
const { reasonCodeSubject } = require('./reason-code-contract')
const { assertUniqueSnapshot, cloneReplaySnapshot, elementList, findElement, findSlide, safeSnapshot, slideList } = require('./generic-journal-safety')

const JOURNAL_VERSION = 1
const valueHash = (value) => hashRecord({ value })
const ownValue = (record, property) => Object.hasOwn(record, property) ? record[property] : undefined
function op(input) { return Object.freeze({ schemaVersion: JOURNAL_VERSION, operationId: `op-${hashRecord(input).slice(0, 24)}`, ...input }) }
function byId(items = []) {
  const result = new Map()
  for (const item of items) { if (!item?.id || result.has(item.id)) throw new TypeError('Invalid generic journal: duplicate identity'); result.set(item.id, item) }
  return result
}
function orderChanges(kind, before, after, context) {
  const left = before.map((item) => item.id); const right = after.map((item) => item.id)
  if (left.length === right.length && left.every((id, index) => id === right[index])) return []
  const address = kind === 'slide' ? { targetId: context.presentationId, parentSlideId: context.parentSlideId ?? null }
    : { targetId: context.slideId, slideId: context.slideId, parentElementId: context.parentElementId ?? null, collectionKey: context.collectionKey }
  return [op({ kind: `${kind}-reorder`, ...address, before: left, after: right, affectedProperties: ['order'], impactClosure: [], inverse: { order: left } })]
}
// Projection journals retain provenance; native adapters authorize package patches separately.
function source(context, id) { return context.sourceMap?.entries?.[`${context.slideId}:${id}`] || null }
function impactClosure(ref, property) {
  if (!ref?.partUri) return []
  return property === 'src' && ref.mediaPartUri ? [ref.partUri, ref.mediaPartUri] : [ref.partUri]
}
function propertyChange(before, after, property, context) {
  const targetKind = context.targetKind || 'element'
  const address = targetKind === 'presentation' ? { targetKind, targetId: before.id }
    : targetKind === 'slide' ? { targetKind, slideId: before.id, parentSlideId: context.parentSlideId ?? null }
      : { targetKind, slideId: context.slideId, elementId: before.id }
  const ref = targetKind === 'element' ? source(context, before.id) : null
  return op({ kind: 'property-change', ...address, property, before: structuredClone(ownValue(before, property)), after: structuredClone(ownValue(after, property)), affectedProperties: [property], sourceRef: ref, impactClosure: impactClosure(ref, property), inverse: { value: structuredClone(ownValue(before, property)) } })
}
function properties(before, after, context) {
  const ignored = new Set(context.targetKind === 'presentation' ? ['id', 'slides'] : ['id', 'elements', 'children'])
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return keys.filter((key) => !ignored.has(key) && valueHash(ownValue(before, key)) !== valueHash(ownValue(after, key)))
    .map((property) => propertyChange(before, after, property, context))
}
function collectionChanges(before, after, property, kind, context, ownerContext = context) {
  const operations = nodes(kind, before[property] || [], after[property] || [], context)
  if ((before[property] === undefined) !== (after[property] === undefined)) {
    const left = { id: before.id, ...(before[property] === undefined ? {} : { [property]: [] }) }
    const right = { id: after.id, ...(after[property] === undefined ? {} : { [property]: [] }) }
    operations.push(propertyChange(left, right, property, ownerContext))
  }
  return operations
}
function nodes(kind, before, after, context) {
  const operations = orderChanges(kind, before, after, context); const left = byId(before); const right = byId(after)
  const address = (id) => kind === 'slide' ? { slideId: id, parentSlideId: context.parentSlideId ?? null }
    : { slideId: context.slideId, elementId: id, parentElementId: context.parentElementId ?? null, collectionKey: context.collectionKey }
  for (let index = 0; index < before.length; index += 1) {
    const value = before[index]; const id = value.id
    if (right.has(id)) continue
    const ref = kind === 'element' ? source(context, id) : null
    operations.push(op({ kind: `${kind}-delete`, ...address(id), before: structuredClone(value), affectedProperties: [kind === 'slide' ? 'slides' : 'elements'], sourceRef: ref, impactClosure: impactClosure(ref), inverse: { kind: `${kind}-add`, ...address(id), index, value: structuredClone(value) } }))
  }
  for (let index = 0; index < after.length; index += 1) {
    const value = after[index]; const id = value.id
    if (!left.has(id)) operations.push(op({ kind: `${kind}-add`, ...address(id), index, after: structuredClone(value), affectedProperties: [kind === 'slide' ? 'slides' : 'elements'], impactClosure: [], inverse: { kind: `${kind}-delete`, ...address(id) }, ...(kind === 'element' ? { patchabilityReason: 'new-lineage-requires-native-id-allocation' } : {}) }))
  }
  for (const id of [...left.keys()].filter((id) => right.has(id)).sort()) {
    const oldValue = left.get(id); const newValue = right.get(id)
    const childContext = { ...context, targetKind: kind, ...(kind === 'slide' ? { slideId: id } : {}) }
    operations.push(...properties(oldValue, newValue, childContext))
    operations.push(...collectionChanges(oldValue, newValue, 'elements', 'element', { ...childContext, parentElementId: kind === 'slide' ? null : id, collectionKey: 'elements' }))
    operations.push(...collectionChanges(oldValue, newValue, 'children', kind, kind === 'slide'
      ? { ...childContext, parentSlideId: id }
      : { ...childContext, parentElementId: id, collectionKey: 'children' }, childContext))
  }
  return operations
}
function deriveMutationJournal(beforeInput, afterInput, options = {}) {
  const before = assertUniqueSnapshot(safeSnapshot(beforeInput, options.budgets), options.budgets); const after = assertUniqueSnapshot(safeSnapshot(afterInput, options.budgets), options.budgets)
  const context = { ...options, targetKind: 'presentation', presentationId: before.id, parentSlideId: null }
  const operations = [...properties(before, after, context), ...nodes('slide', before.slides, after.slides, context)]
  // Deletes release old lineage before additions; final sibling ordering follows membership changes.
  const rank = (item) => item.kind.endsWith('-delete') ? 0 : item.kind === 'property-change' ? 1 : item.kind.endsWith('-add') ? 2 : 3
  operations.sort((left, right) => rank(left) - rank(right))
  const budgets = options.budgets || {}; if (operations.length > (budgets.maxJournalOperations || 10000)) throw new RangeError('Journal operation budget exceeded')
  if (Buffer.byteLength(JSON.stringify(operations)) > (budgets.maxJournalBytes || 16 * 1024 * 1024)) throw new RangeError('Journal aggregate storage budget exceeded')
  if (operations.reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item.inverse)), 0) > (budgets.maxInverseBytes || 8 * 1024 * 1024)) throw new RangeError('Journal inverse budget exceeded')
  const subjects = {
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: featureMatrixHash(),
    matrixAuthoritySubject: createMatrixAuthoritySubject(
      undefined, options.matrixAuthorityEpoch
    ),
    reasonCodeSubject: reasonCodeSubject(),
  }
  return Object.freeze({
    schemaVersion: JOURNAL_VERSION,
    baseRevisionId: options.baseRevisionId || null,
    ...subjects,
    operations: Object.freeze(operations),
    journalHash: hashRecord({ ...subjects, operations }),
  })
}
function replayJournal(snapshotInput, journal) {
  const snapshot = cloneReplaySnapshot(snapshotInput)
  for (const operation of journal.operations || []) {
    const slide = findSlide(snapshot, operation.slideId)
    if (operation.kind === 'property-change') {
      const target = operation.targetKind === 'presentation' ? snapshot : operation.targetKind === 'slide' ? slide
        : findElement(slide?.elements, operation.elementId)?.element
      const current = target && Object.hasOwn(target, operation.property) ? target[operation.property] : undefined
      if (target && valueHash(current) === valueHash(operation.before)) {
        if (operation.after === undefined) delete target[operation.property]
        else Object.defineProperty(target, operation.property, { value: structuredClone(operation.after), enumerable: true, configurable: true, writable: true })
      }
    } else if (operation.kind === 'element-delete' && slide) {
      const found = findElement(slide.elements, operation.elementId)
      const scoped = operation.collectionKey === undefined || found?.items === elementList(slide, operation.parentElementId, operation.collectionKey)
      if (found && scoped) found.items.splice(found.index, 1)
    } else if (operation.kind === 'element-add' && slide) {
      const items = elementList(slide, operation.parentElementId, operation.collectionKey)
      if (items && !findElement(slide.elements, operation.elementId)) items.splice(operation.index ?? items.length, 0, structuredClone(operation.after))
    } else if (operation.kind === 'slide-delete') {
      const items = slideList(snapshot, operation.parentSlideId); const index = items?.findIndex((item) => item.id === operation.slideId)
      if (index >= 0) items.splice(index, 1)
    } else if (operation.kind === 'slide-add' && !slide) {
      const items = slideList(snapshot, operation.parentSlideId)
      if (items) items.splice(operation.index ?? items.length, 0, structuredClone(operation.after))
    } else if (operation.kind.endsWith('-reorder')) {
      const items = operation.kind === 'slide-reorder' ? slideList(snapshot, operation.parentSlideId) : elementList(slide, operation.parentElementId, operation.collectionKey)
      if (items) { const order = new Map(operation.after.map((id, index) => [id, index])); items.sort((a, b) => order.get(a.id) - order.get(b.id)) }
    }
  }
  return snapshot
}
module.exports = { JOURNAL_VERSION, canonicalEditableSnapshot, deriveCanonicalPlainTextJournal, deriveMutationJournal, replayJournal }
