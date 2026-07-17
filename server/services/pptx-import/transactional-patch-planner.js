const { hashRecord } = require('./package-store/schemas')
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, featureMatrixHash, featureRow,
  createMatrixAuthoritySubject, validateMatrixAuthoritySubject,
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
function matrixAuthoritySubject(matrixAuthorityEpoch) {
  return createMatrixAuthoritySubject(undefined, matrixAuthorityEpoch)
}
function block(reasonCode, matrixAuthorityEpoch) {
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
    ...(Number.isSafeInteger(matrixAuthorityEpoch) && matrixAuthorityEpoch > 0
      ? { matrixAuthoritySubject: matrixAuthoritySubject(matrixAuthorityEpoch) }
      : {}),
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
function validateRow(operation, values, expected, matrixAuthorityEpoch) {
  if (values.kind !== 'property-change') return block('OPERATION_KIND_UNSUPPORTED', matrixAuthorityEpoch)
  if (values.rowId !== expected.rowId) return block('NON_SEED_ROW', matrixAuthorityEpoch)
  if (values.objectKind !== expected.objectKind) return block('OBJECT_KIND_MISMATCH', matrixAuthorityEpoch)
  if (![values.slideId, values.elementId, values.propertyId, values.operationId].every((item) => typeof item === 'string' && item)) return block('OPERATION_INVALID', matrixAuthorityEpoch)
  const lookup = bindingLookup(operation)
  if (!lookup) return block('BINDING_MISSING', matrixAuthorityEpoch)
  const row = featureRow(values.rowId, lookup)
  if (row?.type === 'feature-lookup-verdict') return block(row.reason === 'binding-mismatch' ? 'BINDING_MISMATCH' : row.reason === 'incomplete-binding' ? 'BINDING_MISSING' : 'SCOPE_MISMATCH', matrixAuthorityEpoch)
  const source = readSource(operation, expected.sourceKind)
  if (source.code) return block(source.code, matrixAuthorityEpoch)
  const impactClosure = strings(values.impactClosure)
  if (!impactClosure || impactClosure.length !== 1 || impactClosure[0] !== source.ref.partUri) return block('IMPACT_CLOSURE_INVALID', matrixAuthorityEpoch)
  if (!row?.adapterQualified) return block('ROW_ADAPTER_UNQUALIFIED', matrixAuthorityEpoch)
  if (!row.transactionEligible) return block('ROW_TRANSACTION_INELIGIBLE', matrixAuthorityEpoch)
  if (!getPrimitiveAdapterDefinition(row.adapterId)) return block('ADAPTER_REGISTRY_MISSING', matrixAuthorityEpoch)
  return { row, source, impactClosure }
}
function authorizeSeedOperation(operation, matrixAuthorityEpoch) {
  try {
    if (!hasData(operation, TEXT_FIELDS)) return block('OPERATION_INVALID', matrixAuthorityEpoch)
    const values = Object.fromEntries(TEXT_FIELDS.map((field) => [field, value(operation, field)]))
    const checked = validateRow(operation, values, { rowId: SEED_ROW_ID, objectKind: 'text-run', sourceKind: 'text-run' }, matrixAuthorityEpoch)
    if (checked.ok === false) return checked
    if (typeof values.before !== 'string' || typeof values.after !== 'string') return block('TEXT_VALUE_INVALID', matrixAuthorityEpoch)
    const eligibility = normalizeTipTapSinglePlainRun(values.textTransport)
    if (!eligibility.ok) return block(eligibility.code, matrixAuthorityEpoch)
    if (values.after !== eligibility.normalizedText) return block('AFTER_NORMALIZATION_MISMATCH', matrixAuthorityEpoch)
    return Object.freeze({ ok: true, matrixAuthoritySubject: matrixAuthoritySubject(matrixAuthorityEpoch), reasonCodeSubject: reasonCodeSubject(), operation: Object.freeze({ ...values, normalizedText: eligibility.normalizedText, featureId: checked.row.id, adapterId: checked.row.adapterId, level4Promoted: checked.row.level4Promoted, preconditionHash: checked.source.ref.sourceHash, sourceRef: cloneFrozen(checked.source.ref), impactClosure: cloneFrozen(checked.impactClosure) }) })
  } catch { return block('MALFORMED_INPUT', matrixAuthorityEpoch) }
}
function authorizeShapeFillOperation(operation, matrixAuthorityEpoch) {
  try {
    if (!hasData(operation, COMMON_FIELDS) || !hasOnlyOwnFields(operation, COMMON_FIELDS, COMMON_FIELDS)) return block('OPERATION_INVALID', matrixAuthorityEpoch)
    const values = Object.fromEntries(COMMON_FIELDS.map((field) => [field, value(operation, field)]))
    if (values.rowId !== SHAPE_FILL_ROW_ID) return block('NON_SEED_ROW', matrixAuthorityEpoch)
    if (typeof values.before !== 'string' || typeof values.after !== 'string' || !RGB.test(values.before) || !RGB.test(values.after)) return block('SOLID_FILL_INVALID', matrixAuthorityEpoch)
    const checked = validateRow(operation, values, { rowId: SHAPE_FILL_ROW_ID, objectKind: 'shape', sourceKind: 'shape' }, matrixAuthorityEpoch)
    if (checked.ok === false) return checked
    return Object.freeze({ ok: true, matrixAuthoritySubject: matrixAuthoritySubject(matrixAuthorityEpoch), reasonCodeSubject: reasonCodeSubject(), operation: Object.freeze({ ...values, featureId: checked.row.id, adapterId: checked.row.adapterId, level4Promoted: checked.row.level4Promoted, preconditionHash: checked.source.ref.sourceHash, sourceRef: cloneFrozen(checked.source.ref), impactClosure: cloneFrozen(checked.impactClosure) }) })
  } catch { return block('MALFORMED_INPUT', matrixAuthorityEpoch) }
}
function authorizeOperation(operation, matrixAuthorityEpoch) {
  try {
    if (!isPlainRecord(operation)) return block('OPERATION_INVALID', matrixAuthorityEpoch)
    const descriptor = Object.getOwnPropertyDescriptor(operation, 'rowId')
    if (!descriptor) return block('ROW_ID_MISSING', matrixAuthorityEpoch)
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return block('OPERATION_INVALID', matrixAuthorityEpoch)
    const rowId = descriptor.value
    if (typeof rowId !== 'string' || !rowId) return block('ROW_ID_MISSING', matrixAuthorityEpoch)
    if (rowId === SHAPE_FILL_ROW_ID) return authorizeShapeFillOperation(operation, matrixAuthorityEpoch)
    return authorizeSeedOperation(operation, matrixAuthorityEpoch)
  } catch { return block('OPERATION_INVALID', matrixAuthorityEpoch) }
}
function compactOperations(operations, matrixAuthorityEpoch) {
  const latest = new Map()
  for (const operation of operations) {
    const key = JSON.stringify([operation.rowId, operation.slideId, operation.elementId, operation.propertyId, operation.operationId])
    const prior = latest.get(key)
    if (prior && sourceIdentity(prior.sourceRef) !== sourceIdentity(operation.sourceRef)) return block('COMPACTION_SOURCE_IDENTITY_CHANGED', matrixAuthorityEpoch)
    if (prior && prior.after !== operation.before) return block('COMPACTION_BEFORE_AFTER_DISCONTINUITY', matrixAuthorityEpoch)
    latest.set(key, prior ? Object.freeze({ ...operation, before: prior.before }) : operation)
  }
  return Object.freeze([...latest.values()].filter((operation) => hashRecord({ value: operation.before }) !== hashRecord({ value: operation.after })))
}
function compilePatchPlan(journal, { matrixAuthorityEpoch } = {}) {
  try {
    if (!Number.isSafeInteger(matrixAuthorityEpoch) || matrixAuthorityEpoch < 1) {
      return block('JOURNAL_MATRIX_AUTHORITY_SUBJECT_STALE')
    }
    if (!isPlainRecord(journal) || ownData(journal, 'operations') === INVALID) return block('JOURNAL_INVALID', matrixAuthorityEpoch)
    const matrixSchemaVersion = ownData(journal, 'featureMatrixSchemaVersion')
    if (matrixSchemaVersion === INVALID) return block('JOURNAL_MATRIX_SCHEMA_MISSING', matrixAuthorityEpoch)
    if (matrixSchemaVersion !== FEATURE_MATRIX_SCHEMA_VERSION) return block('JOURNAL_MATRIX_SCHEMA_MISMATCH', matrixAuthorityEpoch)
    const matrixVersion = ownData(journal, 'featureMatrixVersion')
    if (matrixVersion === INVALID) return block('JOURNAL_MATRIX_VERSION_MISSING', matrixAuthorityEpoch)
    if (matrixVersion !== CANONICAL_FEATURE_MATRIX_VERSION) return block('JOURNAL_MATRIX_VERSION_MISMATCH', matrixAuthorityEpoch)
    const matrixHash = ownData(journal, 'featureMatrixHash')
    if (typeof matrixHash !== 'string' || !matrixHash) return block('JOURNAL_MATRIX_HASH_MISSING', matrixAuthorityEpoch)
    if (matrixHash !== featureMatrixHash()) return block('JOURNAL_MATRIX_HASH_MISMATCH', matrixAuthorityEpoch)
    const authority = ownData(journal, 'matrixAuthoritySubject')
    if (authority === INVALID) return block('JOURNAL_MATRIX_AUTHORITY_SUBJECT_MISSING', matrixAuthorityEpoch)
    const authorityVerdict = validateMatrixAuthoritySubject(authority, undefined, matrixAuthorityEpoch)
    if (!authorityVerdict.authorized) {
      return block(authorityVerdict.reasons.includes('stale-matrix-authority-epoch')
        ? 'JOURNAL_MATRIX_AUTHORITY_SUBJECT_STALE'
        : 'JOURNAL_MATRIX_AUTHORITY_SUBJECT_INVALID', matrixAuthorityEpoch)
    }
    const reasonSubject = ownData(journal, 'reasonCodeSubject')
    if (reasonSubject === INVALID) return block('JOURNAL_REASON_CODE_SUBJECT_MISSING', matrixAuthorityEpoch)
    const expectedReasonSubject = reasonCodeSubject()
    if (reasonSubject.schemaVersion !== expectedReasonSubject.schemaVersion ||
      reasonSubject.version !== expectedReasonSubject.version || reasonSubject.hash !== expectedReasonSubject.hash) {
      return block('JOURNAL_REASON_CODE_SUBJECT_STALE', matrixAuthorityEpoch)
    }
    const rawOperations = value(journal, 'operations')
    if (!Array.isArray(rawOperations)) return block('JOURNAL_INVALID', matrixAuthorityEpoch)
    const authorized = []
    for (let index = 0; index < rawOperations.length; index += 1) {
      const result = authorizeOperation(ownData(rawOperations, String(index)), matrixAuthorityEpoch)
      if (!result.ok) return result
      authorized.push(result.operation)
    }
    const operations = compactOperations(authorized, matrixAuthorityEpoch)
    if (operations.ok === false) return operations
    const touchedParts = Object.freeze([...new Set(operations.flatMap((item) => item.impactClosure))].sort())
    const relationshipClosure = Object.freeze([...new Set(operations.flatMap((item) => item.sourceRef.relationshipChain))].sort())
    return Object.freeze({ ok: true, operations, touchedParts, relationshipClosure, validationRequirements: Object.freeze(['zip-opc', 'officecli-when-qualified', 'native-reimport', 'impact', 'security']), featureMatrixHash: featureMatrixHash(), featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION, featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION, matrixSubject: matrixSubject(), matrixAuthoritySubject: matrixAuthoritySubject(matrixAuthorityEpoch), reasonCodeSubject: reasonCodeSubject(), level4Promoted: false })
  } catch { return block('MALFORMED_INPUT', matrixAuthorityEpoch) }
}
module.exports = { SEED_ROW_ID, SHAPE_FILL_ROW_ID, authorizeOperation, authorizeSeedOperation, authorizeShapeFillOperation, compactOperations, compilePatchPlan }
