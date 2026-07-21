const { hashRecord } = require('./package-store/schemas')
const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, createMatrixAuthoritySubject,
  featureMatrixHash, getFeatureRow,
} = require('./canonical-feature-matrix')
const { reasonCodeSubject } = require('./reason-code-contract')
const {
  normalizeTipTapSinglePlainRun,
  transportFromTipTapContent,
} = require('./tiptap-single-plain-run-eligibility')
const { createSourceRef } = require('./source-map')
const { INVALID, cloneFrozen, isPlainRecord, ownData } = require('./own-plain-data')

const ROW_ID = 'primitive.text.run.plain-replacement'
const BINDINGS = Object.freeze(['transportId', 'transportSchemaVersion', 'eligibilityPolicyId', 'eligibilityPolicyVersion', 'normalizationContractId', 'normalizationContractVersion'])

function invalid(message) { throw new TypeError(`Invalid canonical plain-text journal: ${message}`) }
function read(record, field) {
  const value = ownData(record, field)
  if (value === INVALID) invalid(`missing ${field}`)
  return value
}
function safeSnapshot(snapshot, budgets) {
  try { return canonicalEditableSnapshot(cloneFrozen(snapshot), budgets) } catch { invalid('snapshot') }
}
function flattenSlides(slides) {
  if (!Array.isArray(slides)) invalid('slides')
  const result = []; const ids = new Set()
  const visit = (items) => items.forEach((slide) => { if (!isPlainRecord(slide) || typeof read(slide, 'id') !== 'string' || !Array.isArray(read(slide, 'elements')) || ids.has(read(slide, 'id'))) invalid('slide'); ids.add(read(slide, 'id')); result.push(slide); const children = ownData(slide, 'children'); if (children !== INVALID) { if (!Array.isArray(children)) invalid('slide'); visit(children) } })
  visit(slides); return result
}
function elementMap(slides) {
  const map = new Map()
  for (const slide of flattenSlides(slides)) for (const element of read(slide, 'elements')) {
    if (!isPlainRecord(element) || typeof read(element, 'id') !== 'string') invalid('element')
    const key = `${read(slide, 'id')}:${read(element, 'id')}`
    if (map.has(key)) invalid('duplicate element identity')
    map.set(key, { slideId: read(slide, 'id'), element })
  }
  return map
}
function equivalentExceptContent(before, after) {
  const left = { ...before }; const right = { ...after }
  delete left.content; delete right.content
  return hashRecord(left) === hashRecord(right)
}
function equivalentExcept(before, after, omitted) {
  const left = { ...before }; const right = { ...after }
  for (const key of omitted) { delete left[key]; delete right[key] }
  return hashRecord(left) === hashRecord(right)
}
function slideTree(slides) {
  if (!Array.isArray(slides)) invalid('slide')
  return slides.map((slide) => {
    const children = ownData(slide, 'children')
    return { id: read(slide, 'id'), children: children === INVALID ? [] : slideTree(children) }
  })
}
function elementIds(slide) {
  return read(slide, 'elements').map((element) => {
    if (!isPlainRecord(element) || typeof read(element, 'id') !== 'string') invalid('element')
    return read(element, 'id')
  })
}
function assertPlainTextScope(before, after, beforeSlides, afterSlides) {
  if (!equivalentExcept(before, after, ['slides']) ||
      hashRecord(slideTree(beforeSlides)) !== hashRecord(slideTree(afterSlides))) {
    invalid('presentation structure')
  }
  const right = new Map(flattenSlides(afterSlides).map((slide) => [read(slide, 'id'), slide]))
  for (const previous of flattenSlides(beforeSlides)) {
    const next = right.get(read(previous, 'id'))
    if (!next || !equivalentExcept(previous, next, ['elements', 'children']) ||
        hashRecord(elementIds(previous)) !== hashRecord(elementIds(next))) invalid('non-text mutation')
  }
}
function bindings() {
  const row = getFeatureRow(ROW_ID)
  if (!row || row.level4Promoted !== false) invalid('feature row')
  return Object.fromEntries(BINDINGS.map((field) => [field, row[field]]))
}
function sourceFor(sourceMap, key, baseRevisionId) {
  if (!isPlainRecord(sourceMap) || ownData(sourceMap, 'schemaVersion') !== 1 || !isPlainRecord(read(sourceMap, 'entries')) ||
      typeof read(sourceMap, 'revisionId') !== 'string' || !Number.isSafeInteger(read(sourceMap, 'packageGeneration'))) invalid('source map')
  const ref = ownData(read(sourceMap, 'entries'), key)
  if (ref === INVALID) invalid('source reference')
  try {
    const source = createSourceRef(ref)
    if (source.status !== 'authoritative' || source.kind !== 'text-run' || source.matchMethod !== 'native-id' || source.confidence !== 1 ||
        source.relationshipChain.length === 0 || source.revisionId !== read(sourceMap, 'revisionId') || source.packageGeneration !== read(sourceMap, 'packageGeneration') ||
        (baseRevisionId !== null && source.revisionId !== baseRevisionId)) invalid('source authority')
    return source
  } catch { invalid('source authority') }
}
function normalizedContent(content) {
  const verdict = normalizeTipTapSinglePlainRun(transportFromTipTapContent(content))
  if (!verdict.ok) invalid('text content')
  return verdict.normalizedText
}
function transportFor(textTransports, key, after) {
  if (!isPlainRecord(textTransports)) invalid('text transport map')
  const transport = ownData(textTransports, key)
  if (transport === INVALID) invalid('text transport')
  const verdict = normalizeTipTapSinglePlainRun(transport)
  if (!verdict.ok || verdict.normalizedText !== after) invalid('text transport')
  try { return cloneFrozen(transport) } catch { invalid('text transport') }
}
function deriveCanonicalPlainTextJournal(beforeInput, afterInput, options = {}) {
  let safeOptions
  try { safeOptions = cloneFrozen(options) } catch { invalid('options') }
  const budgets = ownData(safeOptions, 'budgets') === INVALID ? undefined : ownData(safeOptions, 'budgets')
  const baseRevisionId = ownData(safeOptions, 'baseRevisionId') === INVALID ? null : ownData(safeOptions, 'baseRevisionId')
  if (baseRevisionId !== null && typeof baseRevisionId !== 'string') invalid('base revision')
  const before = safeSnapshot(beforeInput, budgets)
  const after = safeSnapshot(afterInput, budgets)
  const beforeSlides = read(before, 'slides'); const afterSlides = read(after, 'slides')
  assertPlainTextScope(before, after, beforeSlides, afterSlides)
  const left = elementMap(beforeSlides); const right = elementMap(afterSlides)
  if (left.size !== right.size || [...left.keys()].some((key) => !right.has(key))) invalid('element structure')
  const operations = []
  for (const key of [...left.keys()].sort()) {
    const previous = left.get(key); const next = right.get(key)
    if (hashRecord(previous.element) === hashRecord(next.element)) continue
    if (previous.element.type !== 'text' || next.element.type !== 'text' || !equivalentExceptContent(previous.element, next.element)) invalid('non-text mutation')
    const before = normalizedContent(read(previous.element, 'content'))
    const after = normalizedContent(read(next.element, 'content'))
    const sourceRef = sourceFor(ownData(safeOptions, 'sourceMap'), key, baseRevisionId)
    const textTransport = transportFor(ownData(safeOptions, 'textTransports'), key, after)
    operations.push(cloneFrozen({ kind: 'property-change', rowId: ROW_ID, objectKind: 'text-run', slideId: previous.slideId,
      elementId: previous.element.id, propertyId: 'text', operationId: 'replace', before, after, bindings: bindings(),
      textTransport, sourceRef, impactClosure: [sourceRef.partUri] }))
  }
  const requestIdentity = ownData(safeOptions, 'requestIdentity') === INVALID ? null : ownData(safeOptions, 'requestIdentity')
  if (requestIdentity !== null && typeof requestIdentity !== 'string') invalid('request identity')
  const matrixAuthorityEpoch = ownData(safeOptions, 'matrixAuthorityEpoch')
  if (!Number.isSafeInteger(matrixAuthorityEpoch) || matrixAuthorityEpoch < 1) {
    invalid('matrix authority epoch')
  }
  const subjects = {
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: featureMatrixHash(),
    matrixAuthoritySubject: createMatrixAuthoritySubject(undefined, matrixAuthorityEpoch),
    reasonCodeSubject: reasonCodeSubject(),
  }
  const metadata = cloneFrozen({ requestHash: hashRecord({ requestIdentity, baseRevisionId, operations, subjects }) })
  return cloneFrozen({ schemaVersion: 1, baseRevisionId, featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION, featureMatrixHash: featureMatrixHash(),
    matrixAuthoritySubject: subjects.matrixAuthoritySubject, reasonCodeSubject: subjects.reasonCodeSubject,
    operations, journalHash: hashRecord({ operations, metadata, subjects }), metadata, level4Promoted: false })
}
module.exports = { deriveCanonicalPlainTextJournal }
