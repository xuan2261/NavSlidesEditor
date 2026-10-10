const { hashRecord } = require('./schemas')
const { SOURCE_MAP_VERSION, createSourceMap, createSourceRef, rebindSourceMap } = require('../source-map')
const { canonicalEditableSnapshot } = require('../canonical-snapshot')
const { MUTATION_OPERATIONS } = require('../mutation-operation-scope')
const { serverTextTransports } = require('../validated-edited-export-context')
const { rewritePresentationMedia } = require('../../project-import-presentation')
const { validateMatrixAuthoritySubject, createMatrixAuthoritySubject } = require('../canonical-feature-matrix')
const { reasonCodeSubject } = require('../reason-code-contract')

const SUBJECT_FIELDS = ['featureMatrixSchemaVersion', 'featureMatrixVersion', 'featureMatrixHash', 'matrixAuthoritySubject', 'reasonCodeSubject']
const clone = (value) => structuredClone(value)
function invalid() {
  throw Object.assign(new Error('Portable package authority is malformed'), { code: 'PACKAGE_AUTHORITY_UNAVAILABLE' })
}
function subjectsFor(journal) {
  return Object.fromEntries(SUBJECT_FIELDS.map((key) => [key, journal[key]]))
}
function journalHash(journal) {
  const subjects = subjectsFor(journal)
  return hashRecord(journal.metadata
    ? { operations: journal.operations, metadata: journal.metadata, subjects }
    : { ...subjects, operations: journal.operations })
}
function elementTypes(projection, journal) {
  const slides = new Map()
  const visitSlides = (items) => (items || []).forEach((slide) => {
    const elements = new Map()
    const visitElements = (items) => (items || []).forEach((element) => {
      elements.set(element.id, element.type)
      visitElements(element.elements || element.children)
    })
    visitElements(slide.elements)
    slides.set(slide.id, elements)
    visitSlides(slide.children)
  })
  visitSlides(projection?.slides)
  for (const operation of journal?.operations || []) {
    if (operation.kind === 'property-change' && operation.property === 'type' &&
        (operation.before === 'html' || operation.after === 'html')) {
      if (!slides.has(operation.slideId)) slides.set(operation.slideId, new Map())
      slides.get(operation.slideId).set(operation.elementId, 'html')
    }
  }
  return (operation) => slides.get(operation.slideId)?.get(operation.elementId)
}
function snapshotFor(operation, value, type) {
  if (value === undefined) return null
  if (operation.kind === 'slide-add' || operation.kind === 'slide-delete') return { slides: [value] }
  if (operation.kind === 'element-add' || operation.kind === 'element-delete') return { slides: [{ elements: [value] }] }
  if (operation.kind !== 'property-change' || !operation.property) return null
  if (operation.targetKind === 'presentation') return { slides: [], [operation.property]: value }
  if (operation.targetKind === 'slide') return { slides: [{ elements: [], [operation.property]: value }] }
  return { slides: [{ elements: [{ type, [operation.property]: value }] }] }
}
function rewriteSnapshot(operation, value, mediaUrlMap, type) {
  const snapshot = snapshotFor(operation, value, type)
  if (!snapshot) return value
  const rewritten = rewritePresentationMedia(snapshot, mediaUrlMap)
  if (operation.kind === 'property-change' && operation.targetKind === 'presentation') return rewritten[operation.property]
  const slide = rewritten.slides[0]
  if (operation.kind.startsWith('slide-')) return slide
  if (operation.kind.startsWith('element-')) return slide.elements[0]
  return operation.targetKind === 'slide' ? slide[operation.property] : slide.elements[0][operation.property]
}
function journalMediaProjections(journal, projection) {
  const typeFor = elementTypes(projection, journal)
  return (journal?.operations || []).flatMap((operation) =>
    [operation.before, operation.after, operation.inverse?.value]
      .map((value) => snapshotFor(operation, value, typeFor(operation))).filter(Boolean))
}
function validateAuthorityResult(result, head) {
  if (!result || result.schemaVersion !== 1 || typeof result.idempotencyKey !== 'string' || !result.idempotencyKey ||
      result.presentationId !== head.presentationId || result.packageRevisionId !== head.packageRevisionId ||
      !Number.isSafeInteger(result.generation) || result.generation < 1 || result.generation > head.generation ||
      !['committed', 'pending-edited-export'].includes(result.state) ||
      result.projection?.id !== head.presentationId || result.sourceMap?.presentationId !== head.presentationId ||
      result.sourceMap.schemaVersion !== SOURCE_MAP_VERSION ||
      result.sourceMap.revisionId !== result.packageRevisionId || result.sourceMap.packageGeneration !== result.generation) invalid()
  if ((result.operation !== undefined && !Object.values(MUTATION_OPERATIONS).includes(result.operation)) ||
      (result.requestHash !== undefined && !/^[a-f0-9]{64}$/u.test(result.requestHash))) invalid()
  if (hashRecord(canonicalEditableSnapshot(result.projection)) !== hashRecord(result.projection)) invalid()
  let sourceMap
  try { sourceMap = createSourceMap(result.sourceMap) } catch { invalid() }
  if (Object.values(sourceMap.entries).some((ref) =>
    ref.revisionId !== result.packageRevisionId || ref.packageGeneration !== result.generation
  )) invalid()
  if (result.requestIdentity && result.requestIdentity.snapshotHash !== hashRecord(result.projection)) invalid()
  if (result.trustedImportMetadata !== undefined) {
    require('../trusted-import-metadata').validateTrustedImportMetadata(result.trustedImportMetadata, head.originalRevisionId)
  }
  const journal = result.journal
  if (!journal) return
  if (journal.schemaVersion !== 1 || !Array.isArray(journal.operations) || journalHash(journal) !== journal.journalHash ||
      !validateMatrixAuthoritySubject(journal.matrixAuthoritySubject, undefined, journal.matrixAuthoritySubject?.evolutionEpoch).authorized ||
      hashRecord(journal.reasonCodeSubject) !== hashRecord(reasonCodeSubject())) invalid()
  if (journal.featureMatrixSchemaVersion !== journal.matrixAuthoritySubject.schemaVersion ||
      journal.featureMatrixVersion !== journal.matrixAuthoritySubject.matrixVersion ||
      journal.featureMatrixHash !== journal.matrixAuthoritySubject.hash ||
      (journal.metadata && !/^[a-f0-9]{64}$/u.test(journal.metadata.requestHash))) invalid()
  for (const operation of journal.operations) {
    if (!operation || typeof operation.kind !== 'string') invalid()
    if (operation.sourceRef) {
      const ref = createSourceRef(operation.sourceRef)
      if (journal.baseRevisionId && ref.revisionId !== journal.baseRevisionId) invalid()
    }
  }
}
function rebindAuthorityResult(result, identity, mapGeneration, mediaUrlMap) {
  const rebound = { ...clone(result), presentationId: identity.presentationId, generation: mapGeneration(result.generation) }
  rebound.projection = { ...rewritePresentationMedia(result.projection, mediaUrlMap), id: identity.presentationId }
  rebound.sourceMap = rebindSourceMap(result.sourceMap, { presentationId: identity.presentationId, revisionId: result.packageRevisionId, packageGeneration: rebound.generation })
  if (result.requestIdentity) {
    rebound.requestIdentity = { ...clone(result.requestIdentity), expectedGeneration: mapGeneration(result.requestIdentity.expectedGeneration), snapshotHash: hashRecord(rebound.projection) }
  }
  const expectedGeneration = rebound.requestIdentity?.expectedGeneration ?? Math.max(0, rebound.generation - 1)
  if (result.operation === MUTATION_OPERATIONS.PROJECTION_SAVE) {
    rebound.requestHash = hashRecord({ operation: result.operation, presentationId: identity.presentationId, expectedGeneration,
      baseRevisionId: rebound.requestIdentity?.baseRevisionId || result.journal?.baseRevisionId || null, after: rebound.projection })
  } else if (result.operation === MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT) {
    rebound.requestHash = hashRecord({ operation: result.operation, presentationId: identity.presentationId, expectedGeneration,
      baseRevisionId: rebound.requestIdentity?.baseRevisionId || result.journal?.baseRevisionId || null, after: rebound.projection,
      textTransports: serverTextTransports(rebound.projection), pendingEdit: Array.isArray(result.operationIds)
        ? result.operationIds.length > 0 : (result.journal?.operations || []).length > 0,
      budgets: {}, requireOfficeCli: true, policy: null })
  } else if (result.requestHash !== undefined) {
    rebound.requestHash = hashRecord({ operation: result.operation, presentationId: identity.presentationId,
      generation: rebound.generation, projection: rebound.projection, sourceMap: rebound.sourceMap })
  }
  if (result.journal) {
    const journal = clone(result.journal)
    journal.matrixAuthoritySubject = createMatrixAuthoritySubject(undefined, identity.matrixAuthorityEpoch)
    const typeFor = elementTypes(result.projection, result.journal)
    journal.operations = journal.operations.map((operation) => {
      const next = clone(operation)
      for (const field of ['before', 'after']) {
        if (Object.hasOwn(next, field)) next[field] = rewriteSnapshot(operation, next[field], mediaUrlMap, typeFor(operation))
      }
      if (next.inverse && Object.hasOwn(next.inverse, 'value')) next.inverse.value = rewriteSnapshot(operation, next.inverse.value, mediaUrlMap, typeFor(operation))
      if (next.sourceRef) next.sourceRef = { ...next.sourceRef, packageGeneration: mapGeneration(next.sourceRef.packageGeneration) }
      if ((next.targetKind === 'presentation' || next.kind === 'slide-reorder') &&
          next.targetId === result.presentationId) next.targetId = identity.presentationId
      if (/^op-[a-f0-9]{24}$/u.test(next.operationId || '')) {
        const { schemaVersion: _schema, operationId: _id, ...input } = next
        next.operationId = `op-${hashRecord(input).slice(0, 24)}`
      }
      return next
    })
    if (journal.metadata) journal.metadata = { ...journal.metadata, requestHash: hashRecord({ requestIdentity: rebound.requestHash || null,
      baseRevisionId: journal.baseRevisionId, operations: journal.operations, subjects: subjectsFor(journal) }) }
    journal.journalHash = journalHash(journal)
    rebound.journal = journal
    if (Array.isArray(result.operationIds)) rebound.operationIds = result.operationIds.length
      ? journal.operations.map((operation) => operation.operationId) : []
  }
  return rebound
}
module.exports = { journalMediaProjections, rebindAuthorityResult, validateAuthorityResult }
