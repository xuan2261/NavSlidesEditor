const {
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = require('./canonical-feature-matrix')

const CLAIM_CEILING_LEVELS = Object.freeze({
  'original-recovery': 1,
  'package-preservation': 2,
  'valid-edited-package': 3,
  'feature-editability': 4,
  'powerpoint-compatibility-visual-fidelity': 5,
})

function rowSummary(row) {
  const verifiedEditable = row.level4Promoted === true
  const transactionEligible = row.transactionEligible === true
  return Object.freeze({
    id: row.id,
    family: row.family,
    objectKind: row.objectKind,
    tier: row.tier,
    claimCeiling: row.claimCeiling,
    transactionEligible,
    verifiedEditable,
    reasonCode: verifiedEditable
      ? null
      : transactionEligible
        ? 'transaction-eligible-not-verified-editable'
        : 'level4-promotion-unproven',
    reason: verifiedEditable
      ? null
      : transactionEligible
        ? 'Eligible for validated edited-package processing, not verified feature editing.'
        : row.reason,
  })
}

const matrix = Object.freeze({
  schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
  matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
  hash: featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE),
})
const rows = Object.freeze(CANONICAL_FEATURE_MATRIX
  .filter((row) => row.family === 'presentation')
  .map(rowSummary))
const targetClaimLevel = Math.max(...CANONICAL_FEATURE_MATRIX.map(
  (row) => CLAIM_CEILING_LEVELS[row.claimCeiling] || 0,
))

module.exports = Object.freeze({
  schemaVersion: 1,
  matrix,
  maxClaimLevel: 0,
  achievedClaimLevel: 0,
  verifiedClaimLevel: 0,
  targetClaimLevel,
  rows,
})
