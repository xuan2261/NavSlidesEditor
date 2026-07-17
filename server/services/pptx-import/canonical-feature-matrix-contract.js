const { createHash } = require('node:crypto')
const { parseMatrixCatalogs, validateRowBindings } = require('./matrix-catalog-contract')

const FEATURE_TIERS = Object.freeze([
  'native-editable',
  'structured-partial',
  'replace-only-visual',
  'preserved-opaque',
  'unsupported-blocking',
])
const ENVELOPE_FIELDS = Object.freeze([
  'schemaVersion', 'matrixVersion', 'impactPolicies', 'transports',
  'eligibilityPolicies', 'normalizationContracts', 'adapters', 'rows',
])
const ROW_FIELDS = Object.freeze([
  'id', 'family', 'objectKind', 'scope', 'tier', 'claimCeiling',
  'sourceAuthorityRule', 'adapterId', 'impactPolicyId', 'transportId',
  'transportSchemaVersion', 'eligibilityPolicyId', 'eligibilityPolicyVersion',
  'normalizationContractId', 'normalizationContractVersion', 'fixtureIds',
  'requiredTestIds', 'adapterQualified', 'transactionEligible', 'level4Promoted', 'reason',
])

class CanonicalFeatureMatrixValidationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CanonicalFeatureMatrixValidationError'
    this.code = code
  }
}

function invalid(code, message) {
  throw new CanonicalFeatureMatrixValidationError(code, message)
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function requireExactFields(value, fields, label, unknownCode) {
  if (!isRecord(value)) invalid('INVALID_OBJECT', `${label} must be a plain object`)
  for (const field of fields) {
    if (!hasOwn(value, field)) invalid('MISSING_REQUIRED_FIELD', `${label}.${field} is required`)
  }
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) invalid(unknownCode, `${label}.${field} is not allowed`)
  }
}

function identifier(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    invalid('INVALID_IDENTIFIER', `${label} must be a non-empty trimmed string`)
  }
  return value
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) invalid('INVALID_VERSION', `${label} must be a positive integer`)
  return value
}

function identifierSet(values, label) {
  if (!Array.isArray(values) || values.length === 0) {
    invalid('INVALID_IDENTIFIER_SET', `${label} must contain at least one identifier`)
  }
  const normalized = values.map((value, index) => identifier(value, `${label}[${index}]`))
  if (new Set(normalized).size !== normalized.length) invalid('DUPLICATE_IDENTIFIER', `${label} contains duplicates`)
  return Object.freeze([...normalized].sort())
}

function normalizeScope(scope, label) {
  requireExactFields(scope, ['propertyIds', 'operationIds'], label, 'UNKNOWN_SCOPE_FIELD')
  return Object.freeze({
    propertyIds: identifierSet(scope.propertyIds, `${label}.propertyIds`),
    operationIds: identifierSet(scope.operationIds, `${label}.operationIds`),
  })
}

function normalizeRow(row, index) {
  const label = `rows[${index}]`
  requireExactFields(row, ROW_FIELDS, label, 'UNKNOWN_ROW_FIELD')
  const tier = identifier(row.tier, `${label}.tier`)
  if (!FEATURE_TIERS.includes(tier)) invalid('INVALID_TIER', `${label}.tier is not canonical`)
  const adapterId = row.adapterId === null ? null : identifier(row.adapterId, `${label}.adapterId`)
  for (const field of ['adapterQualified', 'transactionEligible', 'level4Promoted']) {
    if (typeof row[field] !== 'boolean') invalid('INVALID_STATE', `${label}.${field} must be boolean`)
  }
  if (row.transactionEligible && !row.adapterQualified) {
    invalid('TRANSACTION_REQUIRES_ADAPTER_QUALIFICATION', `${label} requires an adapter-qualified row`)
  }
  if (row.level4Promoted && (!row.adapterQualified || !row.transactionEligible)) {
    invalid('LEVEL4_PROMOTION_REQUIRES_QUALIFIED_TRANSACTION', `${label} requires a qualified transaction`)
  }
  if (row.adapterQualified && adapterId === null) {
    invalid('ADAPTER_QUALIFICATION_REQUIRES_ADAPTER_ID', `${label} requires an adapter ID`)
  }
  return Object.freeze({
    id: identifier(row.id, `${label}.id`),
    family: identifier(row.family, `${label}.family`),
    objectKind: identifier(row.objectKind, `${label}.objectKind`),
    scope: normalizeScope(row.scope, `${label}.scope`),
    tier,
    claimCeiling: identifier(row.claimCeiling, `${label}.claimCeiling`),
    sourceAuthorityRule: identifier(row.sourceAuthorityRule, `${label}.sourceAuthorityRule`),
    adapterId,
    impactPolicyId: identifier(row.impactPolicyId, `${label}.impactPolicyId`),
    transportId: identifier(row.transportId, `${label}.transportId`),
    transportSchemaVersion: positiveInteger(row.transportSchemaVersion, `${label}.transportSchemaVersion`),
    eligibilityPolicyId: identifier(row.eligibilityPolicyId, `${label}.eligibilityPolicyId`),
    eligibilityPolicyVersion: positiveInteger(row.eligibilityPolicyVersion, `${label}.eligibilityPolicyVersion`),
    normalizationContractId: identifier(row.normalizationContractId, `${label}.normalizationContractId`),
    normalizationContractVersion: positiveInteger(row.normalizationContractVersion, `${label}.normalizationContractVersion`),
    fixtureIds: identifierSet(row.fixtureIds, `${label}.fixtureIds`),
    requiredTestIds: identifierSet(row.requiredTestIds, `${label}.requiredTestIds`),
    adapterQualified: row.adapterQualified,
    transactionEligible: row.transactionEligible,
    level4Promoted: row.level4Promoted,
    reason: identifier(row.reason, `${label}.reason`),
  })
}

function compareIdentifiers(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function parseCanonicalFeatureMatrix(input, schemaVersion = 1) {
  requireExactFields(input, ENVELOPE_FIELDS, 'matrix', 'UNKNOWN_ENVELOPE_FIELD')
  if (input.schemaVersion !== schemaVersion) invalid('UNSUPPORTED_SCHEMA_VERSION', 'matrix schema version is unsupported')
  if (typeof input.matrixVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(input.matrixVersion)) {
    invalid('INVALID_MATRIX_VERSION', 'matrixVersion must be semantic version text')
  }
  if (!Array.isArray(input.rows) || input.rows.length === 0) invalid('INVALID_ROWS', 'matrix rows are required')
  const rows = input.rows.map(normalizeRow).sort((left, right) => compareIdentifiers(left.id, right.id))
  const catalogs = parseMatrixCatalogs(input, invalid)
  const rowIds = new Set()
  const scopes = new Set()
  for (const row of rows) {
    if (rowIds.has(row.id)) invalid('DUPLICATE_ROW_ID', `duplicate row ID: ${row.id}`)
    rowIds.add(row.id)
    const scopeKey = JSON.stringify([row.family, row.objectKind, row.scope.propertyIds, row.scope.operationIds])
    if (scopes.has(scopeKey)) invalid('DUPLICATE_EXACT_SCOPE', `duplicate exact scope: ${row.id}`)
    scopes.add(scopeKey)
  }
  validateRowBindings(rows, catalogs, invalid)
  return Object.freeze({ schemaVersion, matrixVersion: input.matrixVersion, ...catalogs, rows: Object.freeze(rows) })
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function canonicalFeatureMatrixHash(input, schemaVersion = 1) {
  const matrix = parseCanonicalFeatureMatrix(input, schemaVersion)
  return createHash('sha256').update(stableStringify(matrix)).digest('hex')
}

function canonicalMatrixBytes(input, schemaVersion = 1) {
  return Buffer.from(stableStringify(parseCanonicalFeatureMatrix(input, schemaVersion)))
}

module.exports = {
  FEATURE_TIERS,
  CanonicalFeatureMatrixValidationError,
  canonicalMatrixBytes,
  canonicalFeatureMatrixHash,
  parseCanonicalFeatureMatrix,
}
