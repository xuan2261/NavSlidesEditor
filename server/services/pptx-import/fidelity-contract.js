const {
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = require('./canonical-feature-matrix')
const { reasonCodeSubject } = require('./reason-code-contract')

const ORIGINAL_ONLY_KINDS = new Set([
  'activex', 'encryption', 'macro', 'ole', 'protection', 'signature', 'unknown',
])
const SAFE_EDITED_EXPORTS = new Set(['preserve-only', 'unsupported-blocking'])
const CAPABILITY_SUMMARY_FIELDS = new Set([
  'editedExport', 'originalRecovery', 'hasUnsupportedObjects', 'hasUnsafeImpact', 'kinds',
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

function isMalformedCapabilitySummary(summary) {
  if (summary === undefined || summary === null) return false
  if (!isPlainRecord(summary) || Object.keys(summary).some((key) => !CAPABILITY_SUMMARY_FIELDS.has(key))) return true
  if (Object.hasOwn(summary, 'kinds') && (!Array.isArray(summary.kinds) ||
    summary.kinds.some((kind) => typeof kind !== 'string'))) return true
  if (Object.hasOwn(summary, 'hasUnsafeImpact') && typeof summary.hasUnsafeImpact !== 'boolean') return true
  if (Object.hasOwn(summary, 'hasUnsupportedObjects') && typeof summary.hasUnsupportedObjects !== 'boolean') return true
  if (Object.hasOwn(summary, 'originalRecovery') && summary.originalRecovery !== 'exact') return true
  return Object.hasOwn(summary, 'editedExport') && !SAFE_EDITED_EXPORTS.has(summary.editedExport)
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

function exportAvailability(available, label, reasonCode) {
  if (available) return Object.freeze({ available: true, label, reasonCode: null, reason: null })
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
    validatedEditedReasonCode = 'validated-edited-export-unavailable',
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
  const aggregateGeneration = presentation?.pptxAggregateHead?.generation

  return Object.freeze({
    schemaVersion: 1,
    reasonCodeSubject: reasonCodeSubject(),
    presentationId: presentation?.id,
    ...(validatedEdited && Number.isSafeInteger(aggregateGeneration)
      ? { aggregateGeneration }
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
        originalOnlyReason,
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
