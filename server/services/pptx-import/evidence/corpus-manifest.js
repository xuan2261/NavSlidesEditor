const { createHash } = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { CANONICAL_FEATURE_MATRIX } = require('../canonical-feature-matrix')
const { hashCanonical } = require('./canonical-hash')
const { canonicalMatrixSubject, validateMatrixSubject } = require('./matrix-subject')

const CORPUS_MANIFEST_SCHEMA_VERSION = 2
const QUALIFICATION_MANIFEST_SCHEMA_VERSION = 1
const QUALIFICATION_MANIFEST_FIELDS = Object.freeze([
  'schemaVersion',
  'matrix',
  'decks',
  'manifestDigest',
])

async function hashFile(filePath, bytes = null) {
  const content = bytes || await fs.readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

function duplicateHashes(decks) {
  const namesByHash = new Map()
  for (const deck of decks) {
    const names = namesByHash.get(deck.sha256) || []
    names.push(deck.id)
    namesByHash.set(deck.sha256, names)
  }
  return [...namesByHash.values()].filter((names) => names.length > 1)
}

async function buildCorpusInventory(corpusDir) {
  const entries = (await fs.readdir(corpusDir))
    .filter((name) => name.toLowerCase().endsWith('.pptx'))
    .sort((left, right) => left.localeCompare(right))
  const decks = await Promise.all(
    entries.map(async (id) => ({ id, sha256: await hashFile(path.join(corpusDir, id)) }))
  )
  const duplicates = duplicateHashes(decks)
  if (duplicates.length) throw new Error(`duplicate corpus content hash: ${duplicates[0].join(', ')}`)
  return Object.freeze({ corpusDir, decks: Object.freeze(decks.map(Object.freeze)) })
}

function canonicalFixtureIds() {
  return [...new Set(CANONICAL_FEATURE_MATRIX.flatMap((row) => row.fixtureIds))].sort()
}

function resolveFixtureMap(deckIds, fixtureMap) {
  if (fixtureMap !== undefined && !isPlainObject(fixtureMap)) {
    throw new TypeError('fixture mapping must be a plain object')
  }
  const requiredFixtureIds = canonicalFixtureIds()
  const supplied = fixtureMap || {}
  for (const fixtureId of Object.keys(supplied)) {
    if (!requiredFixtureIds.includes(fixtureId)) throw new Error(`unknown canonical fixture: ${fixtureId}`)
  }
  const mapped = {}
  for (const fixtureId of requiredFixtureIds) {
    const deckId = fixtureMap === undefined ? fixtureId : supplied[fixtureId]
    if (typeof deckId !== 'string' || deckId.length === 0) {
      throw new Error(`missing canonical fixture mapping: ${fixtureId}`)
    }
    if (!deckIds.has(deckId)) throw new Error(`unknown corpus deck: ${deckId}`)
    mapped[fixtureId] = deckId
  }
  return Object.freeze(mapped)
}

function coverageRow(row) {
  const content = {
    rowId: row.id,
    fixtureIds: row.fixtureIds,
    editabilityTier: row.tier,
    requiredTests: row.requiredTestIds,
    claimLevel: row.claimCeiling,
    status: row.level4Promoted ? 'covered' : 'excluded',
    ...(row.level4Promoted ? {} : { exclusionReason: row.reason }),
  }
  return Object.freeze({ ...content, sha256: hashCanonical(content) })
}

function buildCoverageRows() {
  return Object.freeze(CANONICAL_FEATURE_MATRIX.map(coverageRow))
}

function qualificationContent(inventory) {
  if (!Array.isArray(inventory?.decks)) throw new TypeError('qualification inventory requires decks')
  return {
    schemaVersion: QUALIFICATION_MANIFEST_SCHEMA_VERSION,
    matrix: canonicalMatrixSubject(),
    decks: inventory.decks.map(({ id, sha256 }) => ({ id, sha256 })),
  }
}

function manifestDigest(manifest) {
  const { manifestDigest: _manifestDigest, ...content } = manifest || {}
  return hashCanonical(content)
}

function buildQualificationManifest(inventory) {
  const content = qualificationContent(inventory)
  return Object.freeze({ ...content, manifestDigest: hashCanonical(content) })
}

function verifyCorpusManifest(manifest, inventory) {
  const errors = []
  if (!isPlainObject(manifest) || Object.keys(manifest).some((key) => !QUALIFICATION_MANIFEST_FIELDS.includes(key))) {
    errors.push('invalid-qualification-manifest')
  }
  if (manifest?.schemaVersion !== QUALIFICATION_MANIFEST_SCHEMA_VERSION) {
    errors.push('unsupported-qualification-manifest-schema')
  }
  errors.push(...validateMatrixSubject(manifest?.matrix, { stale: 'stale-matrix-subject' }))
  if (!isSha256(manifest?.manifestDigest) || manifest.manifestDigest !== manifestDigest(manifest)) {
    errors.push('manifest-digest-mismatch')
  }

  const expectedDecks = Array.isArray(manifest?.decks) ? manifest.decks : []
  const actualDecks = Array.isArray(inventory?.decks) ? inventory.decks : []
  const invalidExpected = expectedDecks.some((deck) => !deck?.id || !isSha256(deck.sha256))
  if (invalidExpected) errors.push('invalid-manifest-deck')
  if (new Set(expectedDecks.map((deck) => deck?.id)).size !== expectedDecks.length) {
    errors.push('duplicate-manifest-deck-id')
  }
  if (duplicateHashes(expectedDecks.filter((deck) => deck?.sha256)).length) {
    errors.push('duplicate-manifest-content-hash')
  }
  if (duplicateHashes(actualDecks.filter((deck) => deck?.sha256)).length) {
    errors.push('duplicate-corpus-content-hash')
  }

  const expectedById = new Map(expectedDecks.map((deck) => [deck.id, deck.sha256]))
  const actualById = new Map(actualDecks.map((deck) => [deck.id, deck.sha256]))
  if (
    expectedById.size !== actualById.size ||
    [...expectedById.keys()].some((id) => !actualById.has(id))
  ) {
    errors.push('corpus-deck-set-mismatch')
  }
  if ([...expectedById].some(([id, sha256]) => actualById.get(id) !== sha256)) {
    errors.push('corpus-deck-hash-mismatch')
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)].sort()),
    manifestDigest: isSha256(manifest?.manifestDigest) ? manifest.manifestDigest : null,
  })
}

async function buildCorpusManifest(corpusDir, fixtureMap) {
  const inventory = await buildCorpusInventory(corpusDir)
  const decks = inventory.decks
  return Object.freeze({
    schemaVersion: CORPUS_MANIFEST_SCHEMA_VERSION,
    matrix: canonicalMatrixSubject(),
    decks,
    fixtureMap: resolveFixtureMap(new Set(decks.map((deck) => deck.id)), fixtureMap),
    features: buildCoverageRows(),
  })
}

module.exports = {
  CORPUS_MANIFEST_SCHEMA_VERSION,
  QUALIFICATION_MANIFEST_SCHEMA_VERSION,
  buildCorpusInventory,
  buildCorpusManifest,
  buildCoverageRows,
  buildQualificationManifest,
  canonicalFixtureIds,
  hashFile,
  manifestDigest,
  resolveFixtureMap,
  verifyCorpusManifest,
}
