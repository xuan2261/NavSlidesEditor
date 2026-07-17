const {
  CANONICAL_FEATURE_MATRIX,
  FEATURE_TIERS,
  getFeatureRow,
} = require('../canonical-feature-matrix')
const { cloneFrozen } = require('../own-plain-data')
const { hashCanonical } = require('./canonical-hash')
const { CLAIM_LEVELS } = require('./claim-contract')
const { validateClaimSubject } = require('./matrix-subject')
const EVIDENCE_SCHEMA_VERSION = 2
const REQUIRED_FIELDS = Object.freeze({
  schemaVersion: 'missing-schema-version',
  matrix: 'missing-feature-matrix',
  claimSubject: 'missing-claim-subject',
  claimLevel: 'missing-claim-level',
  runId: 'missing-run-id',
  sourceSha256: 'missing-source-sha256',
  exportSha256: 'missing-export-sha256',
  packageRevision: 'missing-package-revision',
  corpusManifestHash: 'missing-corpus-manifest-hash',
  corpusDeckIds: 'missing-corpus-deck-ids',
  testCommit: 'missing-test-commit',
  releaseCommit: 'missing-release-commit',
  command: 'missing-command',
  lanes: 'missing-lane-identities',
  thresholds: 'missing-thresholds',
  policyDigest: 'missing-policy-digest',
  evidenceEpoch: 'missing-evidence-epoch',
  createdAt: 'missing-created-at',
  expiresAt: 'missing-expires-at',
  artifacts: 'missing-artifacts',
  privacy: 'missing-evidence-privacy-policy',
  ciAttestation: 'missing-ci-attestation',
})
const ALLOWED_FIELDS = new Set([
  ...Object.keys(REQUIRED_FIELDS),
  'renderer',
  'provider',
  'providerRole',
  'os',
  'officeBuild',
  'fonts',
  'officeCli',
  'sourceOpcInventory',
  'exportOpcInventory',
  'providerAttestation',
])
const COVERAGE_FIELDS = Object.freeze([
  'rowId',
  'fixtureIds',
  'editabilityTier',
  'requiredTests',
  'claimLevel',
  'status',
  'exclusionReason',
  'sha256',
])

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sameIdentifiers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === expected[index])
  )
}

function parseEvidenceManifest(input) {
  let value
  try {
    value = cloneFrozen(input)
  } catch {
    return { ok: false, reasons: ['invalid-evidence-manifest'], value: null }
  }
  const reasons = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reasons: ['invalid-evidence-manifest'], value: null }
  }
  for (const [field, reason] of Object.entries(REQUIRED_FIELDS)) {
    if (value[field] == null || value[field] === '') reasons.push(reason)
  }
  if (Object.keys(input).some((field) => !ALLOWED_FIELDS.has(field))) {
    reasons.push('unknown-evidence-manifest-field')
  }
  if (value.schemaVersion !== EVIDENCE_SCHEMA_VERSION) reasons.push('unsupported-schema-version')
  if (!CLAIM_LEVELS.includes(value.claimLevel)) reasons.push('invalid-claim-level')
  if (value.runId != null && typeof value.runId !== 'string') reasons.push('invalid-run-id')
  for (const field of [
    'sourceSha256',
    'exportSha256',
    'corpusManifestHash',
    'testCommit',
    'releaseCommit',
    'policyDigest',
  ]) {
    if (input[field] != null && !isSha256(input[field])) {
      reasons.push(`invalid-${field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`)
    }
  }
  if (
    value.packageRevision != null &&
    (!Number.isInteger(value.packageRevision) || value.packageRevision < 0)
  ) {
    reasons.push('invalid-package-revision')
  }
  if (
    value.evidenceEpoch != null &&
    (!Number.isInteger(value.evidenceEpoch) || value.evidenceEpoch < 1)
  ) {
    reasons.push('invalid-evidence-epoch')
  }
  if (value.corpusDeckIds != null && !Array.isArray(value.corpusDeckIds)) {
    reasons.push('invalid-corpus-deck-ids')
  }
  if (value.lanes != null && !Array.isArray(value.lanes)) reasons.push('invalid-lane-identities')
  if (value.artifacts != null && !Array.isArray(value.artifacts)) reasons.push('invalid-artifacts')
  if (value.createdAt && !Number.isFinite(Date.parse(value.createdAt)))
    reasons.push('invalid-created-at')
  if (value.expiresAt && !Number.isFinite(Date.parse(value.expiresAt)))
    reasons.push('invalid-expires-at')
  reasons.push(...validateClaimSubject(input))
  return { ok: reasons.length === 0, reasons: [...new Set(reasons)].sort(), value: input }
}

function validateFeatureRows(features) {
  const reasons = []
  if (!Array.isArray(features) || features.length === 0) return ['missing-feature-coverage']
  const seen = new Set()
  for (const coverage of features) {
    if (!isPlainObject(coverage)) {
      reasons.push('invalid-feature-coverage-row')
      continue
    }
    if (Object.keys(coverage).some((field) => !COVERAGE_FIELDS.includes(field))) {
      reasons.push('unknown-feature-coverage-field')
    }
    if (typeof coverage.rowId !== 'string' || coverage.rowId.length === 0) {
      reasons.push('missing-canonical-feature-row-id')
      continue
    }
    if (seen.has(coverage.rowId)) reasons.push('duplicate-canonical-feature-row')
    seen.add(coverage.rowId)
    const row = getFeatureRow(coverage.rowId)
    if (!row) {
      reasons.push('unknown-canonical-feature-row')
      continue
    }
    const { sha256: _sha256, ...content } = coverage
    if (!isSha256(coverage.sha256) || coverage.sha256 !== hashCanonical(content)) {
      reasons.push('feature-row-hash-mismatch')
    }
    if (!FEATURE_TIERS.includes(coverage.editabilityTier)) reasons.push('legacy-feature-tier')
    else if (coverage.editabilityTier !== row.tier) reasons.push('canonical-feature-tier-mismatch')
    if (!sameIdentifiers(coverage.fixtureIds, row.fixtureIds)) {
      reasons.push('canonical-feature-fixtures-mismatch')
    }
    if (!sameIdentifiers(coverage.requiredTests, row.requiredTestIds)) {
      reasons.push('canonical-feature-required-tests-mismatch')
    }
    if (coverage.claimLevel !== row.claimCeiling) {
      reasons.push('canonical-feature-claim-level-mismatch')
    }
    const expectedStatus = row.level4Promoted ? 'covered' : 'excluded'
    if (coverage.status !== expectedStatus) reasons.push('canonical-feature-status-mismatch')
    if (coverage.status === 'excluded' && typeof coverage.exclusionReason !== 'string') {
      reasons.push('feature-exclusion-reason-required')
    } else if (coverage.status === 'excluded' && coverage.exclusionReason !== row.reason) {
      reasons.push('canonical-feature-exclusion-reason-mismatch')
    }
    if (coverage.status === 'covered' && Object.hasOwn(coverage, 'exclusionReason')) {
      reasons.push('canonical-feature-status-mismatch')
    }
  }
  if (CANONICAL_FEATURE_MATRIX.some((row) => !seen.has(row.id))) {
    reasons.push('incomplete-canonical-feature-coverage')
  }
  return [...new Set(reasons)].sort()
}

module.exports = {
  CLAIM_LEVELS,
  EVIDENCE_SCHEMA_VERSION,
  isSha256,
  parseEvidenceManifest,
  validateFeatureRows,
}
