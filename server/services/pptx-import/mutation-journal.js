const { hashRecord } = require('./package-store/schemas')
const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const { deriveCanonicalPlainTextJournal } = require('./canonical-plain-text-journal')
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, createMatrixAuthoritySubject,
  featureMatrixHash,
} = require('./canonical-feature-matrix')
const { reasonCodeSubject } = require('./reason-code-contract')
const { assertPatchableSource } = require('./source-map')
const { assertUniqueSnapshot, cloneReplaySnapshot, elementList, findElement, findSlide, safeSnapshot } = require('./generic-journal-safety')

const JOURNAL_VERSION = 1
const valueHash = (value) => hashRecord({ value })
function op(input) { return Object.freeze({ schemaVersion: JOURNAL_VERSION, operationId: `op-${hashRecord(input).slice(0, 24)}`, ...input }) }
function byId(items = []) {
  const result = new Map()
  for (const item of items) { if (!item?.id || result.has(item.id)) throw new TypeError('Invalid generic journal: duplicate identity'); result.set(item.id, item) }
  return result
}
function orderChanges(kind, before, after, context) {
  const left = before.map((item) => item.id); const right = after.map((item) => item.id); const set = new Set(right)
  if (left.length !== right.length || left.some((id) => !set.has(id)) || left.every((id, index) => id === right[index])) return []
  return [op({ kind: `${kind}-reorder`, targetId: context.slideId, parentElementId: context.parentElementId || null, before: left, after: right, affectedProperties: ['order'], impactClosure: [], inverse: { order: left } })]
}
function source(context, id) { const ref = context.sourceMap?.entries?.[`${context.slideId}:${id}`]; assertPatchableSource(ref); return ref }
function properties(before, after, context) {
  const ignored = new Set(['id', 'elements', 'children']); const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
  return keys.filter((key) => !ignored.has(key) && valueHash(before[key]) !== valueHash(after[key])).map((property) => {
    const ref = source(context, before.id)
    return op({ kind: 'property-change', slideId: context.slideId, elementId: before.id, property, before: structuredClone(before[property]), after: structuredClone(after[property]), affectedProperties: [property], sourceRef: ref, impactClosure: property === 'src' && ref.mediaPartUri ? [ref.partUri, ref.mediaPartUri] : [ref.partUri], inverse: { value: structuredClone(before[property]) } })
  })
}
function elements(before = [], after = [], context) {
  const operations = orderChanges('element', before, after, context); const left = byId(before); const right = byId(after)
  for (const id of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const oldValue = left.get(id); const newValue = right.get(id)
    if (!oldValue) operations.push(op({ kind: 'element-add', slideId: context.slideId, elementId: id, parentElementId: context.parentElementId || null, after: structuredClone(newValue), affectedProperties: ['elements'], impactClosure: [], inverse: { kind: 'element-delete', elementId: id }, patchabilityReason: 'new-lineage-requires-native-id-allocation' }))
    else if (!newValue) { const ref = source(context, id); operations.push(op({ kind: 'element-delete', slideId: context.slideId, elementId: id, before: structuredClone(oldValue), affectedProperties: ['elements'], sourceRef: ref, impactClosure: [ref.partUri], inverse: { kind: 'element-add', value: oldValue } })) }
    else {
      operations.push(...properties(oldValue, newValue, context))
      operations.push(...elements(oldValue.elements || oldValue.children || [], newValue.elements || newValue.children || [], { ...context, parentElementId: id }))
    }
  }
  return operations
}
function deriveMutationJournal(beforeInput, afterInput, options = {}) {
  const before = assertUniqueSnapshot(safeSnapshot(beforeInput, options.budgets)); const after = assertUniqueSnapshot(safeSnapshot(afterInput, options.budgets))
  const operations = orderChanges('slide', before.slides, after.slides, { slideId: before.id }); const left = byId(before.slides); const right = byId(after.slides)
  for (const id of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const oldSlide = left.get(id); const newSlide = right.get(id)
    if (!oldSlide) operations.push(op({ kind: 'slide-add', slideId: id, after: newSlide, affectedProperties: ['slides'], impactClosure: [], inverse: { kind: 'slide-delete', slideId: id } }))
    else if (!newSlide) operations.push(op({ kind: 'slide-delete', slideId: id, before: oldSlide, affectedProperties: ['slides'], impactClosure: [], inverse: { kind: 'slide-add', value: oldSlide } }))
    else operations.push(...elements(oldSlide.elements || [], newSlide.elements || [], { ...options, slideId: id, parentElementId: null }))
  }
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
    if (operation.kind === 'property-change') { const found = findElement(slide?.elements, operation.elementId); if (found && valueHash(found.element[operation.property]) === valueHash(operation.before)) found.element[operation.property] = structuredClone(operation.after) }
    else if (operation.kind === 'element-delete' && slide) { const found = findElement(slide.elements, operation.elementId); if (found) found.items.splice(found.index, 1) }
    else if (operation.kind === 'element-add' && slide) { const items = elementList(slide, operation.parentElementId); if (items && !findElement(slide.elements, operation.elementId)) items.push(structuredClone(operation.after)) }
    else if (operation.kind === 'slide-delete') snapshot.slides = snapshot.slides.filter((item) => item.id !== operation.slideId)
    else if (operation.kind === 'slide-add' && !findSlide(snapshot, operation.slideId)) snapshot.slides.push(structuredClone(operation.after))
    else if (operation.kind.endsWith('-reorder')) { const items = operation.kind === 'slide-reorder' ? snapshot.slides : elementList(slide, operation.parentElementId); if (items) { const order = new Map(operation.after.map((id, index) => [id, index])); items.sort((a, b) => order.get(a.id) - order.get(b.id)) } }
  }
  return snapshot
}
module.exports = { JOURNAL_VERSION, canonicalEditableSnapshot, deriveCanonicalPlainTextJournal, deriveMutationJournal, replayJournal }
