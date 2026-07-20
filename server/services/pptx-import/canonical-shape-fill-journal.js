const { hashRecord } = require('./package-store/schemas')
const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, featureMatrixHash, getFeatureRow,
} = require('./canonical-feature-matrix')
const { createSourceRef } = require('./source-map')

const ROW_ID = 'primitive.shape.solid-fill'
const RGB = /^#?[a-fA-F0-9]{6}$/

function fail(message) { throw new TypeError(`Invalid canonical shape-fill journal: ${message}`) }
function mapElements(snapshot) {
  const result = new Map()
  for (const slide of snapshot.slides || []) for (const element of slide.elements || []) {
    if (!slide?.id || !element?.id || result.has(`${slide.id}:${element.id}`)) fail('element identity')
    result.set(`${slide.id}:${element.id}`, { slide, element })
  }
  return result
}
function rgb(value) {
  if (typeof value !== 'string' || !RGB.test(value)) fail('solid fill')
  return `#${value.replace(/^#/, '').toUpperCase()}`
}
function bindings() {
  const row = getFeatureRow(ROW_ID)
  if (!row) fail('feature row')
  return Object.fromEntries(['transportId', 'transportSchemaVersion', 'eligibilityPolicyId', 'eligibilityPolicyVersion', 'normalizationContractId', 'normalizationContractVersion'].map((key) => [key, row[key]]))
}
function deriveCanonicalShapeFillJournal(beforeInput, afterInput, { sourceMap, baseRevisionId = null, budgets } = {}) {
  const before = canonicalEditableSnapshot(beforeInput, budgets)
  const after = canonicalEditableSnapshot(afterInput, budgets)
  const left = mapElements(before); const right = mapElements(after)
  if (left.size !== right.size || [...left.keys()].some((key) => !right.has(key))) fail('structure')
  const operations = []
  for (const [key, prior] of left) {
    const next = right.get(key); const beforeRest = { ...prior.element }; const afterRest = { ...next.element }
    delete beforeRest.fill; delete afterRest.fill
    if (hashRecord(beforeRest) !== hashRecord(afterRest)) fail('non-fill mutation')
    if (prior.element.fill === next.element.fill) continue
    if (prior.element.type !== 'shape' || next.element.type !== 'shape') fail('object kind')
    const ref = sourceMap?.entries?.[key]
    const sourceRef = createSourceRef(ref)
    if (sourceRef.status !== 'authoritative' || sourceRef.kind !== 'shape' || sourceRef.revisionId !== baseRevisionId) fail('source authority')
    operations.push(Object.freeze({ kind: 'property-change', rowId: ROW_ID, objectKind: 'shape', slideId: prior.slide.id, elementId: prior.element.id, propertyId: 'solid-fill', operationId: 'set-style', before: rgb(prior.element.fill), after: rgb(next.element.fill), bindings: bindings(), sourceRef, impactClosure: Object.freeze([sourceRef.partUri]) }))
  }
  return Object.freeze({
    schemaVersion: 1,
    baseRevisionId,
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: featureMatrixHash(),
    operations: Object.freeze(operations),
    level4Promoted: false,
  })
}
module.exports = { ROW_ID, deriveCanonicalShapeFillJournal }
