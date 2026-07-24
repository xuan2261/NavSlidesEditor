const crypto = require('node:crypto')
const { getMilestone } = require('../sla-contract')
const { verifyLocalEvidenceManifest } = require('../evidence/local-evidence-validator')
const { verifyRoleReceiptBundle } = require('../evidence/local-role-receipts')
const { isSafeRelativePath } = require('./golden-evidence')

const VISUAL_ENVIRONMENT_DIGESTS = Object.freeze([
  'windowsDigest', 'officeDigest', 'fontSetDigest', 'localeDigest',
  'dpiScaleDigest', 'viewportDigest', 'cropLetterboxPolicyDigest',
  'resamplingPolicyDigest', 'capturePolicyDigest',
])
const VISUAL_ARTIFACTS = Object.freeze(['corpus', 'golden', 'actual', 'result'])
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const isSha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
const unique = (reasons) => [...new Set(reasons)].sort()

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function artifactByAlias(manifest, alias) {
  return Array.isArray(manifest?.artifacts) ? manifest.artifacts.find((artifact) => artifact?.alias === alias) : null
}

function validateVisualArtifacts(manifest, contents, visual, reasons) {
  const digestFields = {
    corpus: 'corpusManifestDigest', golden: 'goldenManifestDigest', actual: 'actualManifestDigest', result: 'resultDigest',
  }
  for (const name of VISUAL_ARTIFACTS) {
    const alias = visual.artifacts?.[name]
    if (!isSafeRelativePath(alias)) { reasons.push('unsafe-visual-artifact-alias'); continue }
    const bytes = contents?.[alias]
    const expected = visual[digestFields[name]]
    const artifact = artifactByAlias(manifest, alias)
    if (!bytes || !isSha256(expected) || sha(bytes) !== expected || artifact?.sha256 !== expected) {
      reasons.push('visual-artifact-binding-mismatch')
    }
  }
}

function validateVisualSubject(manifest, contents, reasons) {
  const subject = manifest?.subject
  const visual = subject?.visualOracle
  if (!isRecord(visual) || visual.schemaVersion !== 1) {
    reasons.push('invalid-visual-evidence-subject')
    return null
  }
  if (subject.corpusHash !== visual.corpusManifestDigest) reasons.push('visual-corpus-binding-mismatch')
  if (!isSha256(visual.executionDigest) || !isSha256(visual.authorizationPolicyHash)) reasons.push('invalid-visual-execution-binding')
  for (const key of VISUAL_ENVIRONMENT_DIGESTS) {
    if (!isSha256(visual.environment?.[key]) || subject.environmentIdentity?.[key] !== visual.environment[key]) {
      reasons.push('visual-environment-binding-mismatch')
    }
  }
  const policy = getMilestone('phase08_full')
  if (visual.thresholds?.policyId !== policy.id || visual.thresholds?.meanSsim !== policy.meanSsim ||
    visual.thresholds?.minSsim !== policy.minSsim || !isSha256(visual.thresholds?.policyDigest) ||
    subject.policyDigest !== visual.thresholds.policyDigest) reasons.push('visual-threshold-policy-mismatch')
  if (!Array.isArray(subject.applicationArtifacts) || !subject.applicationArtifacts.length ||
    subject.applicationArtifacts.some((artifact) => !artifact?.id || !isSha256(artifact.sha256))) {
    reasons.push('invalid-visual-application-artifacts')
  }
  if (!Array.isArray(subject.outputs) || !subject.outputs.some((output) => output?.sha256 === visual.resultDigest)) {
    reasons.push('visual-result-output-mismatch')
  }
  validateVisualArtifacts(manifest, contents, visual, reasons)
  return visual
}

function validateReceipts(manifest, receipts, visual, reasons) {
  if (!Array.isArray(receipts) || receipts.length !== 3) reasons.push('missing-powerpoint-role-receipts')
  const window = visual?.receiptWindow
  const bundle = verifyRoleReceiptBundle(receipts, {
    subjectHash: manifest?.subjectHash, start: window?.start, publishedAt: window?.publishedAt,
  })
  if (!bundle.valid) reasons.push(...bundle.reasons)
  if (bundle.verdict !== 'approved') reasons.push('powerpoint-role-receipts-not-approved')
  for (const receipt of receipts || []) {
    if (receipt?.observedExecutionHash !== visual?.executionDigest) reasons.push('role-receipt-execution-mismatch')
    if (receipt?.terminalMachineResultHash !== visual?.resultDigest) reasons.push('role-receipt-result-mismatch')
    if (receipt?.authorizationPolicyHash !== visual?.authorizationPolicyHash) reasons.push('role-receipt-policy-mismatch')
  }
}

function validateVisualGoldenEnvironment({ manifest, goldenManifest } = {}) {
  const environment = manifest?.subject?.visualOracle?.environment
  const capture = goldenManifest?.captureEnvironment
  const renderer = goldenManifest?.renderer
  const reasons = []
  if (!isRecord(environment) || !isRecord(capture) || !isRecord(renderer) ||
    environment.officeDigest !== renderer.officeDigest || environment.windowsDigest !== renderer.windowsDigest) {
    reasons.push('visual-golden-environment-mismatch')
  }
  for (const key of [
    'fontSetDigest', 'localeDigest', 'dpiScaleDigest', 'viewportDigest',
    'cropLetterboxPolicyDigest', 'resamplingPolicyDigest',
  ]) if (environment?.[key] !== capture?.[key]) reasons.push('visual-golden-environment-mismatch')
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

function validateVisualEvidenceEnvelope({ manifest, contents = {}, receipts } = {}) {
  const base = verifyLocalEvidenceManifest(manifest, contents)
  const reasons = [...base.reasons]
  const visual = validateVisualSubject(manifest, contents, reasons)
  if (visual) validateReceipts(manifest, receipts, visual, reasons)
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = {
  VISUAL_ARTIFACTS, VISUAL_ENVIRONMENT_DIGESTS, validateVisualEvidenceEnvelope, validateVisualGoldenEnvironment,
}
