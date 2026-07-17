const { isSha256, parseEvidenceManifest, validateFeatureRows } = require('./manifest-schema')
const { CLAIM_LEVELS, CLAIM_WORDING } = require('./claim-contract')
const { cloneFrozen, INVALID, isPlainRecord, ownData } = require('../own-plain-data')
const { getFeatureRow } = require('../canonical-feature-matrix')
const { hashCanonical } = require('./canonical-hash')
const { validateArtifacts } = require('./artifact-validator')
const { CORPUS_MANIFEST_SCHEMA_VERSION } = require('./corpus-manifest')
const { validateLedger } = require('./ledger-validator')
const { validateMatrixSubject } = require('./matrix-subject')
const { validateTrust } = require('./trust-validator')

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function artifactContent(contents, filePath) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(contents || {}, filePath)
    return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : null
  } catch { return null }
}

function passingSemanticTestIds(manifest, artifactContents) {
  const semantic = manifest.artifacts?.find((artifact) => artifact.kind === 'semantic')
  const bytes = semantic && artifactContent(artifactContents, semantic.path)
  if (!bytes) return new Set()
  try {
    const report = JSON.parse(Buffer.from(bytes).toString('utf8'))
    return new Set(
      (report.tests || []).filter((test) => test.result === 'pass').map((test) => test.id)
    )
  } catch {
    return new Set()
  }
}

function validateFixtureMap(corpus, deckIds, reasons) {
  if (!isPlainObject(corpus.fixtureMap)) {
    reasons.push('missing-corpus-fixture-map')
    return
  }
  const canonicalFixtureIds = new Set()
  for (const coverage of corpus.features || []) {
    for (const fixtureId of coverage?.fixtureIds || []) canonicalFixtureIds.add(fixtureId)
  }
  for (const fixtureId of Object.keys(corpus.fixtureMap)) {
    if (!canonicalFixtureIds.has(fixtureId)) reasons.push('unknown-corpus-fixture-map-entry')
  }
  for (const fixtureId of canonicalFixtureIds) {
    const deckId = corpus.fixtureMap[fixtureId]
    if (typeof deckId !== 'string' || deckId.length === 0) {
      reasons.push('missing-corpus-fixture-map-entry')
    } else if (!deckIds.has(deckId)) {
      reasons.push('unknown-feature-fixture')
    }
  }
}

function validateCorpus(manifest, corpus, level, artifactContents, reasons) {
  if (!corpus || typeof corpus !== 'object') {
    reasons.push('missing-corpus-manifest')
    return
  }
  if (corpus.schemaVersion !== CORPUS_MANIFEST_SCHEMA_VERSION) {
    reasons.push('unsupported-corpus-manifest-schema')
  }
  reasons.push(
    ...validateMatrixSubject(corpus.matrix, {
      missing: 'missing-corpus-matrix-subject',
      invalid: 'invalid-corpus-matrix-subject',
      stale: 'stale-corpus-matrix-subject',
    })
  )
  if (hashCanonical(corpus.matrix) !== hashCanonical(manifest.matrix)) {
    reasons.push('corpus-matrix-subject-mismatch')
  }
  if (hashCanonical(corpus) !== manifest.corpusManifestHash) reasons.push('stale-corpus-manifest')
  const actualIds = (corpus.decks || [])
    .map((deck) => deck?.id)
    .filter(Boolean)
    .sort()
  const selectedIds = Array.isArray(manifest.corpusDeckIds)
    ? [...manifest.corpusDeckIds].sort()
    : []
  if (
    new Set(actualIds).size !== actualIds.length ||
    actualIds.length !== selectedIds.length ||
    actualIds.some((id, index) => id !== selectedIds[index])
  ) {
    reasons.push('incomplete-corpus-deck-set')
  }
  if ((corpus.decks || []).some((deck) => !deck?.id || !isSha256(deck.sha256))) {
    reasons.push('unhashed-corpus-deck')
  }
  reasons.push(...validateFeatureRows(corpus.features))
  const deckIds = new Set(actualIds)
  validateFixtureMap(corpus, deckIds, reasons)
  if (level >= 3) {
    const passingTests = passingSemanticTestIds(manifest, artifactContents)
    if (
      (corpus.features || [])
        .filter((row) => row.status === 'covered')
        .some((row) => row.requiredTests.some((id) => !passingTests.has(id)))
    ) {
      reasons.push('missing-required-semantic-test')
    }
    if (
      !(corpus.features || []).some(
        (coverage) => coverage.status === 'covered' && getFeatureRow(coverage.rowId)?.level4Promoted
      )
    ) {
      reasons.push('no-promoted-feature-coverage')
    }
  }
}

function validateTime(manifest, policy, now, reasons) {
  const created = Date.parse(manifest.createdAt)
  const expires = Date.parse(manifest.expiresAt)
  const current = now instanceof Date ? now.getTime() : Date.now()
  if (Number.isFinite(created) && created > current) reasons.push('evidence-created-in-future')
  if (Number.isFinite(expires) && expires <= current) reasons.push('evidence-expired')
  if (Number.isFinite(created) && Number.isFinite(expires) && expires <= created) {
    reasons.push('evidence-time-range-inverted')
  }
  const retentionMs = policy?.privacy?.retentionDays * 24 * 60 * 60 * 1000
  if (
    Number.isFinite(created) &&
    Number.isFinite(expires) &&
    Number.isFinite(retentionMs) &&
    expires - created > retentionMs
  ) {
    reasons.push('evidence-retention-exceeded')
  }
}

function evaluateClaim(input = {}) {
  if (!isPlainRecord(input)) return { claimLevel: null, outcome: 'unavailable', passed: false, reasons: ['invalid-untrusted-evidence-input'], wording: null }
  const read = (field) => ownData(input, field)
  const artifactContents = read('artifactContents')
  const now = read('now')
  let data
  try {
    data = cloneFrozen({
      manifest: read('manifest') === INVALID ? {} : read('manifest') || {},
      corpus: read('corpus') === INVALID ? null : read('corpus') || null,
      trustRoot: read('trustRoot') === INVALID ? null : read('trustRoot') || null,
      trustedConfig: read('trustedConfig') === INVALID ? null : read('trustedConfig') || null,
      ledger: read('ledger') === INVALID ? null : read('ledger') || null,
    })
  } catch {
    return { claimLevel: null, outcome: 'unavailable', passed: false, reasons: ['invalid-untrusted-evidence-input'], wording: null }
  }
  const parsed = parseEvidenceManifest(data.manifest)
  const manifest = parsed.value || Object.create(null)
  const reasons = [...parsed.reasons]
  const level = CLAIM_LEVELS.indexOf(manifest.claimLevel)
  const artifacts = validateArtifacts(manifest, Math.max(level, 0), artifactContents, reasons)
  validateCorpus(manifest, data.corpus, level, artifactContents, reasons)
  const policy = validateTrust(manifest, data.trustRoot, level, artifacts, reasons, data.trustedConfig)
  validateLedger(manifest, policy, data.trustRoot || {}, data.ledger, reasons, data.trustedConfig)
  validateTime(manifest, policy, now, reasons)
  if (!manifest.privacy?.visibility || !manifest.privacy?.redaction ||
    !Number.isInteger(manifest.privacy?.retentionDays) || manifest.privacy.retentionDays < 1) {
    reasons.push('missing-evidence-privacy-policy')
  } else if (hashCanonical(manifest.privacy) !== hashCanonical(policy?.privacy)) reasons.push('privacy-policy-mismatch')
  const uniqueReasons = [...new Set(reasons)].sort()
  return {
    claimLevel: CLAIM_LEVELS.includes(manifest.claimLevel) ? manifest.claimLevel : null,
    outcome: uniqueReasons.length === 0 ? 'verified' : 'unavailable',
    passed: uniqueReasons.length === 0, reasons: uniqueReasons, wording: CLAIM_WORDING[manifest.claimLevel] || null,
  }
}

module.exports = { CLAIM_WORDING, evaluateClaim, hashCanonical }
