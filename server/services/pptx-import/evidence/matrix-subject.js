const {
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = require('../canonical-feature-matrix')
const { hashCanonical } = require('./canonical-hash')
const { canonicalReasonCodes } = require('../reason-code-contract')

const MATRIX_FIELDS = Object.freeze(['schemaVersion', 'matrixVersion', 'hash'])
const CLAIM_SUBJECT_FIELDS = Object.freeze([
  'sourceSha256',
  'exportSha256',
  'packageRevision',
  'corpusManifestHash',
  'matrix',
])

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactFields(value, fields) {
  return (
    isPlainObject(value) &&
    fields.every((field) => Object.hasOwn(value, field)) &&
    Object.keys(value).every((field) => fields.includes(field))
  )
}

function canonicalMatrixSubject() {
  return Object.freeze({
    schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    hash: featureMatrixHash(),
  })
}

function validateMatrixSubject(
  subject,
  {
    missing = 'missing-feature-matrix',
    invalid = 'invalid-feature-matrix',
    stale = 'stale-feature-matrix-subject',
  } = {}
) {
  if (subject == null) return canonicalReasonCodes([missing])
  if (!hasExactFields(subject, MATRIX_FIELDS)) return canonicalReasonCodes([invalid])
  const expected = canonicalMatrixSubject()
  return hashCanonical(subject) === hashCanonical(expected) ? [] : canonicalReasonCodes([stale])
}

function buildClaimSubject(manifest = {}) {
  return Object.freeze({
    sourceSha256: manifest.sourceSha256,
    exportSha256: manifest.exportSha256,
    packageRevision: manifest.packageRevision,
    corpusManifestHash: manifest.corpusManifestHash,
    matrix: canonicalMatrixSubject(),
  })
}

function claimSubjectHash(subject) {
  return hashCanonical(subject)
}

function validateClaimSubject(manifest) {
  const reasons = [...validateMatrixSubject(manifest?.matrix)]
  const subject = manifest?.claimSubject
  if (subject == null) return canonicalReasonCodes([...reasons, 'missing-claim-subject'])
  if (!hasExactFields(subject, CLAIM_SUBJECT_FIELDS)) {
    return canonicalReasonCodes([...reasons, 'invalid-claim-subject'])
  }
  reasons.push(
    ...validateMatrixSubject(subject.matrix, {
      missing: 'invalid-claim-subject',
      invalid: 'invalid-claim-subject',
      stale: 'stale-claim-subject',
    })
  )
  if (hashCanonical(subject) !== hashCanonical(buildClaimSubject(manifest))) {
    reasons.push('stale-claim-subject')
  }
  return canonicalReasonCodes(reasons)
}

module.exports = {
  CLAIM_SUBJECT_FIELDS,
  MATRIX_FIELDS,
  buildClaimSubject,
  canonicalMatrixSubject,
  claimSubjectHash,
  validateClaimSubject,
  validateMatrixSubject,
}
