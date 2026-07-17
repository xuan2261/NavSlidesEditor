const { hashRecord } = require('./package-store/schemas')
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, featureMatrixHash, featureRow,
} = require('./canonical-feature-matrix')
const { getPrimitiveAdapterDefinition } = require('./primitive-adapter-registry')
const { normalizeTipTapSinglePlainRun } = require('./tiptap-single-plain-run-eligibility')
const { INVALID, cloneFrozen, hasOnlyOwnFields, isPlainRecord, ownData } = require('./own-plain-data')
const { canonicalReasonCodes, reasonCodeSubject } = require('./reason-code-contract')

const SEED_ROW_ID = 'primitive.text.run.plain-replacement'
const SHAPE_FILL_ROW_ID = 'primitive.shape.solid-fill'
const BINDINGS = Object.freeze(['transportId', 'transportSchemaVersion', 'eligibilityPolicyId', 'eligibilityPolicyVersion', 'normalizationContractId', 'normalizationContractVersion'])
const SOURCE_HASH = /^[a-f0-9]{64}$/
const RGB = /^#[A-F0-9]{6}$/
const COMMON_FIELDS = Object.freeze(['kind', 'rowId', 'objectKind', 'slideId', 'elementId', 'propertyId', 'operationId', 'before', 'after', 'bindings', 'sourceRef', 'impactClosure'])
const TEXT_FIELDS = Object.freeze([...COMMON_FIELDS, 'textTransport'])

function matrixSubject() {
  return Object.freeze({
    schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    hash: featureMatrixHash(),
  })
}
function block(reasonCode) {
  const reasonCodes = canonicalReasonCodes([reasonCode])
  return Object.freeze({
    ok: false,
    blockReason: reasonCodes[0],
    reasonCode: reasonCodes[0],
    reasonCodes,
    reasonCodeSubject: reasonCodeSubject(),
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: featureMatrixHash(),
    matrixSubject: matrixSubject(),
  })
}
function value(record, field) {
  const result = ownData(record, field)
  if (result === INVALID) throw new TypeError('Missing own data field')
  return result
}
function hasData(record, fields) { return isPlainRecord(record) && fields.every((field) => ownData(record, field) !== INVALID) }
function strings(input, required = true) {
  if (!Array.isArray(input) || (required && input.length === 0)) return null
  const result = []
  for (let index = 0; index < input.length; index += 1) {
    const item = ownData(input, String(index))
    if (typeof item !== 'string' || !item) return null
    result.push(item)
  }
  return result
}
function sourceIdentity(ref) { return JSON.stringify([ref.packageGeneration, ref.revisionId, ref.partUri, ref.nativeId, ref.sourceHash, ref.kind, ref.matchMethod, ref.confidence, ref.relationshipChain]) }
function bindingLookup(operation) {
  const bindings = value(operation, 'bindings')
  if (!hasOnlyOwnFields(bindings, BINDINGS, BINDINGS)) return null
  const pairs = BINDINGS.map((field) => [field, value(bindings, field)])
  if (pairs.some(([, item]) => item === undefined || item === null)) return null
  return Object.fromEntries([['propertyId', value(operation, 'propertyId')], ['operationId', value(operation, 'operationId')], ...pairs])
}
function readSource(operation, expectedKind) {
  const ref = value(operation, 'sourceRef')
  const fields = ['status', 'kind', 'packageGeneration', 'revisionId', 'matchMethod', 'confidence', 'nativeId', 'partUri', 'sourceHash', 'relationshipChain']
  if (!hasData(ref, fields)) return { code: 'SOURCE_REFERENCE_INVALID' }
  const result = Object.fromEntries(fields.map((field) => [field, value(ref, field)]))
  result.relationshipChain = strings(result.relationshipChain)
  if (!result.relationshipChain) return { code: 'RELATIONSHIP_CHAIN_INVALID' }
  if (result.status !== 'authoritative') return { code: 'SOURCE_NOT_AUTHORITATIVE' }
  if (result.kind !== expectedKind) return { code: 'SOURCE_OBJECT_KIND_MISMATCH' }
  if (!Number.isSafeInteger(result.packageGeneration) || result.packageGeneration < 1 || typeof result.revisionId !== 'string' || !result.revisionId || result.matchMethod !== 'native-id' || result.confidence !== 1 || !/^[1-9]\d*$/u.test(result.nativeId) || !Number.isSafeInteger(Number(result.nativeId)) || typeof result.partUri !== 'string' || !result.partUri || typeof result.sourceHash !== 'string' || !SOURCE_HASH.test(result.sourceHash)) return { code: 'SOURCE_REFERENCE_INVALID' }
  return { ref: result }
}
function validateRow(operation, values, expected) {
  if (values.kind !== 'property-change') return block('OPERATION_KIND_UNSUPPORTED')
  if (values.rowId !== expected.rowId) return block('NON_SEED_ROW')
  if (values.objectKind !== expected.objectKind) return block('OBJECT_KIND_MISMATCH')
  if (![values.slideId, values.elementId, values.propertyId, values.operationId].every((item) => typeof item === 'string' && item)) return block('OPERATION_INVALID')
  const lookup = bindingLookup(operation)
  if (!lookup) return block('BINDING_MISSING')
  const row = featureRow(values.rowId, lookup)
  if (row?.type === 'feature-lookup-verdict') return block(row.reason === 'binding-mismatch' ? 'BINDING_MISMATCH' : row.reason === 'incomplete-binding' ? 'BINDING_MISSING' : 'SCOPE_MISMATCH')
  const source = readSource(operation, expected.sourceKind)
  if (source.code) return block(source.code)
  const impactClosure = strings(values.impactClosure)
  if (!impactClosure || impactClosure.length !== 1 || impactClosure[0] !== source.ref.partUri) return block('IMPACT_CLOSURE_INVALID')
  if (!row?.adapterQualified) return block('ROW_ADAPTER_UNQUALIFIED')
  if (!row.transactionEligible) return block('ROW_TRANSACTION_INELIGIBLE')
  if (!getPrimitiveAdapterDefinition(row.adapterId)) return block('ADAPTER_REGISTRY_MISSING')
  return { row, source, impactClosure }
}
function authorizeSeedOperation(operation) {
  try {
    if (!hasData(operation, TEXT_FIELDS)) return block('OPERATION_INVALID')
    const values = Object.fromEntries(TEXT_FIELDS.map((field) => [field, value(operation, field)]))
    const checked = validateRow(operation, values, { rowId: SEED_ROW_ID, objectKind: 'text-run', sourceKind: 'text-run' })
    if (checked.ok === false) return checked
    if (typeof values.before !== 'string' || typeof values.after !== 'string') return block('TEXT_VALUE_INVALID')
    const eligibility = normalizeTipTapSinglePlainRun(values.textTransport)
    if (!eligibility.ok) return block(eligibility.code)
    if (values.after !== eligibility.normalizedText) return block('AFTER_NORMALIZATION_MISMATCH')
    return Object.freeze({ ok: true, operation: Object.freeze({ ...values, normalizedText: eligibility.normalizedText, featureId: checked.row.id, adapterId: checked.row.adapterId, level4Promoted: checked.row.level4Promoted, preconditionHash: checked.source.ref.sourceHash, sourceRef: cloneFrozen(checked.source.ref), impactClosure: cloneFrozen(checked.impactClosure) }) })
  } catch { return block('MALFORMED_INPUT') }
}
function authorizeShapeFillOperation(operation) {
  try {
    if (!hasData(operation, COMMON_FIELDS) || !hasOnlyOwnFields(operation, COMMON_FIELDS, COMMON_FIELDS)) return block('OPERATION_INVALID')
    const values = Object.fromEntries(COMMON_FIELDS.map((field) => [field, value(operation, field)]))
    if (values.rowId !== SHAPE_FILL_ROW_ID) return block('NON_SEED_ROW')
    if (typeof values.before !== 'string' || typeof values.after !== 'string' || !RGB.test(values.before) || !RGB.test(values.after)) return block('SOLID_FILL_INVALID')
    const checked = validateRow(operation, values, { rowId: SHAPE_FILL_ROW_ID, objectKind: 'shape', sourceKind: 'shape' })
    if (checked.ok === false) return checked
    return Object.freeze({ ok: true, operation: Object.freeze({ ...values, featureId: checked.row.id, adapterId: checked.row.adapterId, level4Promoted: checked.row.level4Promoted, preconditionHash: checked.source.ref.sourceHash, sourceRef: cloneFrozen(checked.source.ref), impactClosure: cloneFrozen(checked.impactClosure) }) })
  } catch { return block('MALFORMED_INPUT') }
}
function authorizeOperation(operation) {
  try {
    if (!isPlainRecord(operation)) return block('OPERATION_INVALID')
    const descriptor = Object.getOwnPropertyDescriptor(operation, 'rowId')
    if (!descriptor) return block('ROW_ID_MISSING')
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return block('OPERATION_INVALID')
    const rowId = descriptor.value
    if (typeof rowId !== 'string' || !rowId) return block('ROW_ID_MISSING')
    if (rowId === SHAPE_FILL_ROW_ID) return authorizeShapeFillOperation(operation)
    return authorizeSeedOperation(operation)
  } catch { return block('OPERATION_INVALID') }
}
function compactOperations(operations) {
  const latest = new Map()
  for (const operation of operations) {
    const key = JSON.stringify([operation.rowId, operation.slideId, operation.elementId, operation.propertyId, operation.operationId])
    const prior = latest.get(key)
    if (prior && sourceIdentity(prior.sourceRef) !== sourceIdentity(operation.sourceRef)) return block('COMPACTION_SOURCE_IDENTITY_CHANGED')
    if (prior && prior.after !== operation.before) return block('COMPACTION_BEFORE_AFTER_DISCONTINUITY')
    latest.set(key, prior ? Object.freeze({ ...operation, before: prior.before }) : operation)
  }
  return Object.freeze([...latest.values()].filter((operation) => hashRecord({ value: operation.before }) !== hashRecord({ value: operation.after })))
}
function compilePatchPlan(journal) {
  try {
    if (!isPlainRecord(journal) || ownData(journal, 'operations') === INVALID) return block('JOURNAL_INVALID')
    const matrixSchemaVersion = ownData(journal, 'featureMatrixSchemaVersion')
    if (matrixSchemaVersion === INVALID) return block('JOURNAL_MATRIX_SCHEMA_MISSING')
    if (matrixSchemaVersion !== FEATURE_MATRIX_SCHEMA_VERSION) return block('JOURNAL_MATRIX_SCHEMA_MISMATCH')
    const matrixVersion = ownData(journal, 'featureMatrixVersion')
    if (matrixVersion === INVALID) return block('JOURNAL_MATRIX_VERSION_MISSING')
    if (matrixVersion !== CANONICAL_FEATURE_MATRIX_VERSION) return block('JOURNAL_MATRIX_VERSION_MISMATCH')
    const matrixHash = ownData(journal, 'featureMatrixHash')
    if (typeof matrixHash !== 'string' || !matrixHash) return block('JOURNAL_MATRIX_HASH_MISSING')
    if (matrixHash !== featureMatrixHash()) return block('JOURNAL_MATRIX_HASH_MISMATCH')
    const rawOperations = value(journal, 'operations')
    if (!Array.isArray(rawOperations)) return block('JOURNAL_INVALID')
    const authorized = []
    for (let index = 0; index < rawOperations.length; index += 1) {
      const result = authorizeOperation(ownData(rawOperations, String(index)))
      if (!result.ok) return result
      authorized.push(result.operation)
    }
    const operations = compactOperations(authorized)
    if (operations.ok === false) return operations
    const touchedParts = Object.freeze([...new Set(operations.flatMap((item) => item.impactClosure))].sort())
    const relationshipClosure = Object.freeze([...new Set(operations.flatMap((item) => item.sourceRef.relationshipChain))].sort())
    return Object.freeze({ ok: true, operations, touchedParts, relationshipClosure, validationRequirements: Object.freeze(['zip-opc', 'officecli-when-qualified', 'native-reimport', 'impact', 'security']), featureMatrixHash: featureMatrixHash(), featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION, featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION, matrixSubject: matrixSubject(), reasonCodeSubject: reasonCodeSubject(), level4Promoted: false })
  } catch { return block('MALFORMED_INPUT') }
}
module.exports = { SEED_ROW_ID, SHAPE_FILL_ROW_ID, authorizeOperation, authorizeSeedOperation, authorizeShapeFillOperation, compactOperations, compilePatchPlan }
