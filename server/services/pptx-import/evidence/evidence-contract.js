const { CLAIM_LEVELS, parseEvidenceManifest, validateFeatureRows } = require('./manifest-schema')
const { CLAIM_WORDING, evaluateClaim, hashCanonical } = require('./claim-evaluator')
const localEvidence = require('./local-evidence-contract')
const localRoleReceipts = require('./local-role-receipts')

module.exports = {
  CLAIM_LEVELS,
  CLAIM_WORDING,
  evaluateClaim,
  hashCanonical,
  parseEvidenceManifest,
  validateFeatureRows,
  ...localEvidence,
  ...localRoleReceipts,
}
