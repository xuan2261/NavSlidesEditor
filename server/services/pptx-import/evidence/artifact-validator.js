const { createHash } = require('node:crypto')
const { hashCanonical } = require('./canonical-hash')
const { buildClaimSubject, claimSubjectHash } = require('./matrix-subject')

const REQUIRED_KINDS = Object.freeze([
  ['original'],
  ['original', 'package', 'security', 'resource'],
  ['original', 'package', 'validity', 'security', 'resource'],
  ['original', 'package', 'validity', 'semantic', 'security', 'resource'],
  ['original', 'package', 'validity', 'semantic', 'security', 'resource', 'visual'],
])

function artifactBytes(contents, filePath) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(contents || {}, filePath)
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : null
  } catch { return null }
}

function parseJson(bytes) {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8'))
  } catch {
    return null
  }
}

function validateArtifactFiles(manifest, artifacts, artifactContents, reasons) {
  for (const artifact of artifacts) {
    const bytes = artifactBytes(artifactContents, artifact.path)
    if (!artifact.path || bytes == null) {
      reasons.push('missing-artifact-file')
      continue
    }
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== artifact.sha256) reasons.push('artifact-file-hash-mismatch')
    if (artifact.kind === 'original' && digest !== manifest.sourceSha256) {
      reasons.push('source-file-hash-mismatch')
    }
    if (artifact.kind === 'package' && digest !== manifest.exportSha256) {
      reasons.push('export-file-hash-mismatch')
    }
    if (!['original', 'package'].includes(artifact.kind)) {
      const report = parseJson(bytes)
      if (!report) reasons.push('invalid-artifact-report')
      else {
        if (report.kind !== artifact.kind) reasons.push('artifact-kind-mismatch')
        if (report.result !== 'pass') reasons.push('artifact-result-failed')
        if (artifact.kind === 'visual') validateVisualReport(report, manifest, reasons)
      }
    }
  }
}

function validateVisualReport(report, manifest, reasons) {
  if (hashCanonical(report.threshold) !== hashCanonical(manifest.thresholds)) {
    reasons.push('artifact-threshold-mismatch')
  }
  if (
    !Number.isFinite(report.meanSsim) ||
    !Number.isFinite(manifest.thresholds?.meanSsim) ||
    report.meanSsim < manifest.thresholds.meanSsim
  ) {
    reasons.push('visual-threshold-failed')
  }
}

function isNormalizedOpcInventory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return entries.length > 0 && entries.every(([part, hash]) =>
    part.startsWith('/') && /^[a-f0-9]{64}$/i.test(hash))
}

function validateNoEditBytes(manifest, artifacts, artifactContents, reasons) {
  const original = artifacts.find((artifact) => artifact?.kind === 'original')
  const exported = artifacts.find((artifact) => artifact?.kind === 'package')
  if (manifest.sourceSha256 !== manifest.exportSha256) reasons.push('no-edit-sha256-mismatch')
  const source = original && artifactBytes(artifactContents, original.path)
  const output = exported && artifactBytes(artifactContents, exported.path)
  if (source != null && output != null && !Buffer.from(source).equals(Buffer.from(output))) {
    reasons.push('no-edit-byte-identity-mismatch')
  }
  if (!isNormalizedOpcInventory(manifest.sourceOpcInventory) ||
    !isNormalizedOpcInventory(manifest.exportOpcInventory)) {
    reasons.push('missing-no-edit-opc-inventory')
  } else if (hashCanonical(manifest.sourceOpcInventory) !== hashCanonical(manifest.exportOpcInventory)) {
    reasons.push('no-edit-opc-inventory-mismatch')
  }
}

function validateArtifacts(manifest, level, artifactContents, reasons) {
  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : []
  const expectedSubjectHash = claimSubjectHash(buildClaimSubject(manifest))
  for (const kind of REQUIRED_KINDS[level] || []) {
    if (!artifacts.some((artifact) => artifact?.kind === kind))
      reasons.push(`missing-${kind}-artifact`)
    if (!manifest.lanes?.includes(kind)) reasons.push(`missing-${kind}-lane`)
  }
  for (const artifact of artifacts) {
    if (artifact?.runId !== manifest.runId) reasons.push('cross-run-evidence')
    if (
      artifact?.sourceSha !== manifest.sourceSha256 ||
      artifact?.exportSha !== manifest.exportSha256 ||
      artifact?.packageRevision !== manifest.packageRevision
    ) {
      reasons.push('artifact-package-mismatch')
    }
    if (!artifact?.sha256) reasons.push('missing-artifact-hash')
    if (!artifact?.claimSubjectHash) reasons.push('missing-artifact-claim-subject-hash')
    else if (artifact.claimSubjectHash !== expectedSubjectHash) {
      reasons.push('artifact-claim-subject-mismatch')
    }
    if (artifact?.result !== 'pass') reasons.push('artifact-result-failed')
  }
  validateArtifactFiles(manifest, artifacts, artifactContents, reasons)
  if (level === 1) validateNoEditBytes(manifest, artifacts, artifactContents, reasons)
  validateVisualMetadata(artifacts, level, reasons)
  return artifacts
}

function validateVisualMetadata(artifacts, level, reasons) {
  if (level !== 4) return
  for (const visual of artifacts.filter((artifact) => artifact?.kind === 'visual')) {
    if (visual.placeholder === true || visual.width < 16 || visual.height < 16) {
      reasons.push('visual-placeholder')
    }
    if (
      !visual.sourceRenderer ||
      !visual.candidateRenderer ||
      visual.sourceRenderer === visual.candidateRenderer
    )
      reasons.push('visual-self-comparison')
  }
}

module.exports = { validateArtifacts }
