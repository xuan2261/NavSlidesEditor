const {
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = require('./canonical-feature-matrix')
const { COMPLEX_OBJECT_TIERS } = require('./complex-object-policy')
const { reasonCodeSubject } = require('./reason-code-contract')

const ORIGINAL_ONLY_KINDS = new Set([
  'activex', 'encryption', 'macro', 'ole', 'protection', 'signature', 'unknown',
])
const SAFE_EDITED_EXPORTS = new Set(['preserve-only', 'unsupported-blocking'])
const CAPABILITY_SUMMARY_FIELDS = new Set([
  'editedExport', 'originalRecovery', 'hasUnsupportedObjects', 'hasUnsafeImpact', 'kinds',
  'rowIds', 'tiers', 'matrixHash',
])
const CANONICAL_ROW_IDS = new Set(CANONICAL_FEATURE_MATRIX.map((row) => row.id))
const CANONICAL_ROWS_BY_ID = new Map(CANONICAL_FEATURE_MATRIX.map((row) => [row.id, row]))
const CANONICAL_TIERS = new Set(CANONICAL_FEATURE_MATRIX.map((row) => row.tier))
const COMPLEX_KINDS_BY_NORMALIZED = new Map(Object.keys(COMPLEX_OBJECT_TIERS)
  .map((kind) => [kind.toLowerCase(), kind]))
const KNOWN_COMPLEX_KINDS = new Set(COMPLEX_KINDS_BY_NORMALIZED.keys())
const REQUIRED_CAPABILITY_FIELDS = Object.freeze([
  'editedExport', 'originalRecovery', 'hasUnsupportedObjects', 'hasUnsafeImpact',
  'kinds', 'rowIds', 'tiers', 'matrixHash',
])
const CLAIM_CEILING_LEVELS = Object.freeze({
  'original-recovery': 1,
  'package-preservation': 2,
  'valid-edited-package': 3,
  'feature-editability': 4,
  'powerpoint-compatibility-visual-fidelity': 5,
})
const SAFE_REASONS = Object.freeze({
  'original-package-unverified': 'The original package is not verified for download.',
  'validated-edited-export-unavailable': 'A validated edited revision is not available.',
  'no-op-reconciliation-available': 'Only a no-op package reconciliation is available.',
  'transaction-eligible-not-verified-editable': 'Eligible for validated edited-package processing, not verified feature editing.',
  'original-only-package': 'This package can only be recovered as its original file.',
})

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function safeKinds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((kind) => typeof kind === 'string'))]
}

function validEvidenceList(value, allowed) {
  return Array.isArray(value) && value.every((item) =>
    typeof item === 'string' && allowed.has(item))
}

function sameSortedSet(left, right) {
  const normalizedLeft = [...new Set(left)].sort()
  const normalizedRight = [...new Set(right)].sort()
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
}

function isMalformedCapabilitySummary(summary) {
  if (summary === undefined || summary === null) return false
  if (!isPlainRecord(summary) || Object.keys(summary).some((key) => !CAPABILITY_SUMMARY_FIELDS.has(key))) return true
  if (REQUIRED_CAPABILITY_FIELDS.some((field) => !Object.hasOwn(summary, field))) return true
  if (!SAFE_EDITED_EXPORTS.has(summary.editedExport) || summary.originalRecovery !== 'exact') return true
  if (typeof summary.hasUnsafeImpact !== 'boolean' ||
      typeof summary.hasUnsupportedObjects !== 'boolean') return true
  if (!Array.isArray(summary.kinds) || summary.kinds.some((kind) =>
    typeof kind !== 'string' || !KNOWN_COMPLEX_KINDS.has(kind.toLowerCase()))) return true
  if (new Set(summary.kinds.map((kind) => kind.toLowerCase())).size !== summary.kinds.length) return true
  if (!validEvidenceList(summary.rowIds, CANONICAL_ROW_IDS) ||
      !validEvidenceList(summary.tiers, CANONICAL_TIERS) ||
      new Set(summary.rowIds).size !== summary.rowIds.length ||
      new Set(summary.tiers).size !== summary.tiers.length) return true
  if (summary.matrixHash !== MATRIX.hash) return true

  const descriptors = summary.kinds.map((kind) =>
    COMPLEX_OBJECT_TIERS[COMPLEX_KINDS_BY_NORMALIZED.get(kind.toLowerCase())])
  const expectedRowIds = descriptors.map((descriptor) => descriptor.rowId)
  const expectedTiers = descriptors.map((descriptor) => descriptor.tier)
  const expectedUnsafeImpact = descriptors.some((descriptor) =>
    descriptor.editedExport === 'unsupported-blocking')
  if (!sameSortedSet(summary.rowIds, expectedRowIds) ||
      !sameSortedSet(summary.tiers, expectedTiers) ||
      summary.hasUnsupportedObjects !== (summary.kinds.length > 0) ||
      summary.hasUnsafeImpact !== expectedUnsafeImpact ||
      summary.editedExport !== (expectedUnsafeImpact ? 'unsupported-blocking' : 'preserve-only')) return true
  for (const rowId of summary.rowIds) {
    const row = CANONICAL_ROWS_BY_ID.get(rowId)
    if (!row || !['complex', 'presentation'].includes(row.family)) return true
  }
  return false
}

function safeReason(reasonCode, fallbackCode) {
  const code = SAFE_REASONS[reasonCode] ? reasonCode : fallbackCode
  return Object.freeze({ reasonCode: code, reason: SAFE_REASONS[code] })
}

function rowSummary(row, originalOnly) {
  const verifiedEditable = !originalOnly && row.level4Promoted === true
  const transactionEligible = !originalOnly && row.transactionEligible === true
  const unavailable = originalOnly
    ? safeReason('original-only-package', 'validated-edited-export-unavailable')
    : transactionEligible
      ? safeReason('transaction-eligible-not-verified-editable', 'validated-edited-export-unavailable')
      : Object.freeze({ reasonCode: 'level4-promotion-unproven', reason: row.reason })
  return Object.freeze({
    id: row.id,
    family: row.family,
    objectKind: row.objectKind,
    tier: row.tier,
    claimCeiling: row.claimCeiling,
    transactionEligible,
    verifiedEditable,
    reasonCode: verifiedEditable ? null : unavailable.reasonCode,
    reason: verifiedEditable ? null : unavailable.reason,
  })
}

const MATRIX = Object.freeze({
  schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
  matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
  hash: featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE),
})
const TARGET_CLAIM_LEVEL = Math.max(...CANONICAL_FEATURE_MATRIX.map(
  (row) => CLAIM_CEILING_LEVELS[row.claimCeiling] || 0,
))

function safeFeatureRows(originalOnly) {
  return Object.freeze(CANONICAL_FEATURE_MATRIX.map((row) => rowSummary(row, originalOnly)))
}

function isOriginalOnly(summary) {
  return isMalformedCapabilitySummary(summary) ||
    summary?.hasUnsafeImpact === true ||
    summary?.editedExport === 'unsupported-blocking' ||
    safeKinds(summary?.kinds).some((kind) => ORIGINAL_ONLY_KINDS.has(kind.toLowerCase()))
}

function exportAvailability(available, label, reasonCode, { reconciliationOnly = false } = {}) {
  if (available) return Object.freeze({ available: true, label, reasonCode: null, reason: null })
  if (reconciliationOnly) {
    return Object.freeze({
      available: false,
      reconciliationAvailable: true,
      label,
      ...safeReason(reasonCode, 'validated-edited-export-unavailable'),
    })
  }
  return Object.freeze({ available: false, label, ...safeReason(reasonCode, 'validated-edited-export-unavailable') })
}

function createConflict(expectedRevision, actualRevision) {
  return Object.freeze({
    status: 409,
    code: 'pptx-revision-conflict',
    conflict: Object.freeze({
      expectedRevision: Number(expectedRevision) || 0,
      actualRevision: Number(actualRevision) || 0,
      recovery: 'reload-and-review',
      destructive: false,
    }),
  })
}

function buildFidelityDto(
  presentation,
  {
    officeCliAvailable = false,
    verifiedOriginalAvailable = false,
    validatedEditedAvailable = false,
    validatedEditedNoOpAvailable = false,
    validatedEditedReasonCode = 'validated-edited-export-unavailable',
    aggregateGeneration: aggregateGenerationOverride,
  } = {},
) {
  const original = presentation?.pptxOriginal
  const hasOriginal = Boolean(original)
  const hasPackageHead = Boolean(presentation?.pptxAggregateHead?.packageRevisionId)
  const sourceBacked = hasOriginal || hasPackageHead
  const originalOnly = sourceBacked && [
    presentation?.capabilitySummary,
    original?.capabilitySummary,
  ].some(isOriginalOnly)
  const originalAvailable = sourceBacked && verifiedOriginalAvailable === true
  const verifiedClaimLevel = originalAvailable ? 1 : 0
  const originalOnlyReason = originalOnly ? 'original-only-package' : validatedEditedReasonCode
  const validatedEdited = sourceBacked && !originalOnly && validatedEditedAvailable === true
  const aggregateGeneration = Number.isSafeInteger(aggregateGenerationOverride)
    ? aggregateGenerationOverride
    : presentation?.pptxAggregateHead?.generation

  return Object.freeze({
    schemaVersion: 1,
    reasonCodeSubject: reasonCodeSubject(),
    presentationId: presentation?.id,
    ...(validatedEdited || validatedEditedNoOpAvailable
      ? (Number.isSafeInteger(aggregateGeneration) ? { aggregateGeneration } : {})
      : {}),
    matrix: MATRIX,
    fidelity: Object.freeze({
      status: sourceBacked ? (originalOnly ? 'original-only' : 'source-backed') : 'reconstructed',
      maxClaimLevel: verifiedClaimLevel,
      achievedClaimLevel: verifiedClaimLevel,
      verifiedClaimLevel,
      targetClaimLevel: TARGET_CLAIM_LEVEL,
      level5Available: false,
      editabilityTier: originalOnly ? 'original-only' : 'preserved-opaque',
      rows: safeFeatureRows(originalOnly),
    }),
    exports: Object.freeze({
      original: exportAvailability(originalAvailable, 'Download Original', 'original-package-unverified'),
      validatedEdited: exportAvailability(
        validatedEdited,
        'Export Validated Edited Revision',
        validatedEditedNoOpAvailable
          ? 'no-op-reconciliation-available'
          : originalOnlyReason,
        { reconciliationOnly: validatedEditedNoOpAvailable },
      ),
      reconstructed: Object.freeze({
        available: !originalOnly,
        label: 'Generate Reconstructed PPTX',
        roundtrip: false,
        description: 'Creates a new PPTX and is not a roundtrip export.',
        reasonCode: originalOnly ? 'original-only-package' : null,
        reason: originalOnly ? SAFE_REASONS['original-only-package'] : null,
      }),
    }),
    officeCli: Object.freeze({
      available: Boolean(officeCliAvailable),
      guidance: officeCliAvailable
        ? null
        : 'OfficeCLI is unavailable. Original download remains available when source bytes exist.',
    }),
  })
}

function createSuccessorQueue(generate) {
  const jobs = new Map()
  return async function enqueue({ presentationId, revision, idempotencyKey }) {
    const key = `${presentationId}:${revision}:${idempotencyKey}`
    if (!jobs.has(key)) jobs.set(key, Promise.resolve().then(() => generate({ presentationId, revision })))
    return jobs.get(key)
  }
}

module.exports = { buildFidelityDto, createConflict, createSuccessorQueue }
