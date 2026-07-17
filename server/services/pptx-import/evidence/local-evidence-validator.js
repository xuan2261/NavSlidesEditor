const { canonicalMatrixSubject, validateMatrixSubject } = require('./matrix-subject')
const { CLAIM_LEVELS } = require('./claim-contract')
const { hashCanonical } = require('./canonical-hash')
const {
  BOUNDED_COMPATIBILITY, LOCAL_AUTHORITY, LOCAL_EVIDENCE_SCHEMA_VERSION,
  LOCAL_LIMITATIONS, SUBJECT_FIELDS, isRecord, isSha256, sha256, unique,
} = require('./local-evidence-values')

function push(reasons, condition, reason) {
  if (condition) reasons.push(reason)
}

function verifySubject(subject, reasons) {
  if (!isRecord(subject)) {
    reasons.push('invalid-local-evidence-subject')
    return
  }
  for (const field of SUBJECT_FIELDS) {
    if (subject[field] == null || subject[field] === '') {
      reasons.push(`missing-subject-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`)
    }
  }
  for (const field of [
    'packageRevisionHash', 'originalSha256', 'exportSha256', 'projectionRevisionHash',
    'compactedJournalHash', 'policyDigest', 'corpusHash', 'commandSetHash',
  ]) push(reasons, subject[field] != null && !isSha256(subject[field]), `invalid-subject-${field}`)
  reasons.push(...validateMatrixSubject(subject.matrix, {
    missing: 'missing-subject-matrix', invalid: 'invalid-subject-matrix', stale: 'stale-subject-matrix',
  }))
  push(reasons, !isRecord(subject.environmentIdentity), 'invalid-subject-environment-identity')
  push(reasons, !Array.isArray(subject.applicationArtifacts), 'invalid-subject-application-artifacts')
  push(reasons, !Array.isArray(subject.outputs), 'invalid-subject-outputs')
  push(reasons, !isRecord(subject.thresholds), 'invalid-subject-thresholds')
}

function verifyArtifacts(manifest, contents, reasons) {
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0) {
    reasons.push('missing-stage-artifacts')
    return
  }
  for (const artifact of manifest.artifacts) {
    if (!isRecord(artifact) || typeof artifact.alias !== 'string') {
      reasons.push('invalid-stage-artifact')
      continue
    }
    const bytes = contents?.[artifact.alias]
    if (!bytes) {
      reasons.push('missing-artifact')
      continue
    }
    push(reasons, !Number.isSafeInteger(artifact.byteLength), 'invalid-artifact-length')
    push(reasons, artifact.byteLength !== bytes.length, 'artifact-length-mismatch')
    push(reasons, !isSha256(artifact.sha256), 'invalid-artifact-hash')
    push(reasons, artifact.sha256 !== sha256(bytes), 'artifact-hash-mismatch')
    push(reasons, artifact.stageInvocationId !== manifest.stage?.invocationId, 'mixed-stage-artifact')
    push(reasons, artifact.stageSubjectHash !== manifest.stage?.subjectHash, 'artifact-stage-subject-mismatch')
  }
}

function verifyClaimLadder(claimLadder, reasons) {
  if (!isRecord(claimLadder)) {
    reasons.push('invalid-claim-ladder')
    return
  }
  for (const level of CLAIM_LEVELS) {
    const claim = claimLadder[level]
    if (!isRecord(claim) || !['verified', 'unavailable', 'failed', 'stale', 'cancelled'].includes(claim.verdict)) {
      reasons.push('invalid-claim-ladder')
      return
    }
    if (!Array.isArray(claim.reasons) || claim.reasons.some((reason) => typeof reason !== 'string')) {
      reasons.push('invalid-claim-reasons')
    }
  }
}

function verifyLocalEvidenceManifest(manifest, contents = {}) {
  const reasons = []
  if (!isRecord(manifest)) return { verified: false, reasons: ['invalid-local-evidence-manifest'] }
  push(reasons, manifest.schemaVersion !== LOCAL_EVIDENCE_SCHEMA_VERSION, 'unsupported-local-evidence-schema')
  push(reasons, manifest.authority !== LOCAL_AUTHORITY,
    manifest.authority ? 'historical-authority-not-local' : 'missing-local-authority')
  verifySubject(manifest.subject, reasons)
  push(reasons, manifest.subjectHash !== hashCanonical(manifest.subject), 'local-evidence-subject-hash-mismatch')
  push(reasons, !isRecord(manifest.stage) || typeof manifest.stage.invocationId !== 'string' ||
    typeof manifest.stage.rootFlowId !== 'string' || !isSha256(manifest.stage.subjectHash), 'invalid-evidence-stage')
  verifyArtifacts(manifest, contents, reasons)
  verifyClaimLadder(manifest.claimLadder, reasons)
  for (const limitation of LOCAL_LIMITATIONS) {
    push(reasons, !manifest.limitations?.includes(limitation), 'missing-local-limitation')
  }
  push(reasons, manifest.compatibility !== BOUNDED_COMPATIBILITY, 'unbounded-compatibility-wording')
  return { verified: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = { canonicalMatrixSubject, verifyLocalEvidenceManifest }
