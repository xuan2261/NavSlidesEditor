const { buildLocalEvidenceManifest, buildPrivateCapabilityDto } = require('./local-evidence-contract')
const { hashCanonical } = require('./canonical-hash')
const { validateMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { validateReasonCodeSubject } = require('../reason-code-contract')

function digest(value) {
  return hashCanonical({ value: value ?? null })
}

function claimLadder(fidelity) {
  const verified = Number.isSafeInteger(fidelity?.verifiedClaimLevel)
    ? fidelity.verifiedClaimLevel
    : 0
  return {
    'original-recovery': { verdict: verified >= 1 ? 'verified' : 'unavailable', reasons: [] },
    'package-preservation': { verdict: verified >= 2 ? 'verified' : 'unavailable', reasons: [] },
    'valid-edited-package': { verdict: verified >= 3 ? 'verified' : 'unavailable', reasons: [] },
    'feature-editability': { verdict: verified >= 4 ? 'verified' : 'unavailable', reasons: [] },
    'powerpoint-compatibility-visual-fidelity': {
      verdict: verified >= 5 ? 'verified' : 'unavailable',
      reasons: ['local-oracle-unavailable'],
    },
  }
}

function capabilityRows(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    tier: row.tier,
    eligible: row.transactionEligible === true,
    promoted: row.verifiedEditable === true,
    verdict: row.verifiedEditable ? 'verified' : 'unavailable',
    reasons: row.reasonCode ? [row.reasonCode] : [],
  }))
}

function buildPrivateFidelityCapability(presentation, fidelityDto, {
  officeCliAvailable = false,
  originalAvailable = false,
} = {}) {
  const authorities = validateMatrixAuthoritySubjects(
    presentation?.pptxAggregateHead?.matrixAuthoritySubjects,
    undefined,
    presentation?.pptxAggregateHead?.matrixAuthorityEpoch
  )
  const reasonAuthority = validateReasonCodeSubject(fidelityDto?.reasonCodeSubject)
  const packageRevision = presentation?.pptxAggregateHead?.packageRevisionId
  const original = presentation?.pptxOriginal?.sha256
  const matrix = fidelityDto.matrix
  const manifest = buildLocalEvidenceManifest({
    subject: {
      packageRevisionHash: digest(packageRevision),
      originalSha256: digest(original),
      exportSha256: digest(packageRevision || original),
      projectionRevisionHash: digest(presentation?.pptxAggregateHead?.generation),
      sourceMapVersion: 'unavailable',
      compactedJournalHash: digest(presentation?.pptxAggregateHead?.journalRevisionId),
      matrix,
      reasonCodeSubject: fidelityDto?.reasonCodeSubject,
      policyDigest: digest('fidelity-capability-policy-v1'),
      corpusHash: digest('unavailable'),
      commandSetHash: digest('unavailable'),
      environmentIdentity: {},
      applicationArtifacts: [],
      outputs: [],
      thresholds: {},
    },
    stage: {},
    artifacts: [],
    claimLadder: authorities.authorized
      ? claimLadder(fidelityDto.fidelity)
      : claimLadder({ verifiedClaimLevel: 0 }),
  })
  return buildPrivateCapabilityDto({
    manifest,
    generation: presentation?.pptxAggregateHead?.generation,
    rows: capabilityRows(fidelityDto.fidelity?.rows).map((row) => authorities.authorized && reasonAuthority.authorized
      ? row
      : {
        ...row,
        eligible: false,
        promoted: false,
        verdict: 'stale',
        reasons: [authorities.authorized ? 'unknown-reason-code' : 'STALE_MATRIX_AUTHORITY'],
      }),
    officeCli: { verdict: officeCliAvailable ? 'available' : 'unavailable' },
    localOracle: { verdict: 'unavailable' },
    originalAvailable,
  })
}

module.exports = { buildPrivateFidelityCapability }
