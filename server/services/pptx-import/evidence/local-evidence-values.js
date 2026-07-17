const { createHash } = require('node:crypto')

const LOCAL_EVIDENCE_SCHEMA_VERSION = 1
const LOCAL_AUTHORITY = 'local'
const LOCAL_LIMITATIONS = Object.freeze([
  'profile-access-not-proven',
  'network-egress-isolation-not-proven',
  'independent-descendant-containment-not-proven',
  'teardown-attestation-not-proven',
  'separate-approvers-not-proven',
])
const BOUNDED_COMPATIBILITY =
  'Locally evaluated only for the recorded Windows, Office, OfficeCLI, fonts, locale, DPI, corpus, configuration, matrix, thresholds, package, output, and application artifact hashes.'
const SUBJECT_FIELDS = Object.freeze([
  'packageRevisionHash', 'originalSha256', 'exportSha256', 'projectionRevisionHash',
  'sourceMapVersion', 'compactedJournalHash', 'matrix', 'policyDigest', 'corpusHash',
  'commandSetHash', 'environmentIdentity', 'applicationArtifacts', 'outputs', 'thresholds',
])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function unique(reasons) {
  return [...new Set(reasons)].sort()
}

module.exports = {
  BOUNDED_COMPATIBILITY,
  LOCAL_AUTHORITY,
  LOCAL_EVIDENCE_SCHEMA_VERSION,
  LOCAL_LIMITATIONS,
  SUBJECT_FIELDS,
  isRecord,
  isSha256,
  sha256,
  unique,
}
