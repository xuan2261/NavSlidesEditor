const { createHash } = require('node:crypto')
const fs = require('fs-extra')
const path = require('node:path')
const { CANONICAL_FEATURE_MATRIX } = require('../canonical-feature-matrix')
const { hashCanonical } = require('./canonical-hash')
const { canonicalMatrixSubject } = require('./matrix-subject')

const CORPUS_MANIFEST_SCHEMA_VERSION = 2

async function hashFile(filePath) {
  const bytes = await fs.readFile(filePath)
  return createHash('sha256').update(bytes).digest('hex')
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
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
    if (!requiredFixtureIds.includes(fixtureId)) {
      throw new Error(`unknown canonical fixture: ${fixtureId}`)
    }
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

async function buildCorpusManifest(corpusDir, fixtureMap) {
  const entries = (await fs.readdir(corpusDir))
    .filter((name) => name.toLowerCase().endsWith('.pptx'))
    .sort((left, right) => left.localeCompare(right))
  const decks = await Promise.all(
    entries.map(async (name) => ({
      id: name,
      sha256: await hashFile(path.join(corpusDir, name)),
    }))
  )
  return Object.freeze({
    schemaVersion: CORPUS_MANIFEST_SCHEMA_VERSION,
    matrix: canonicalMatrixSubject(),
    decks: Object.freeze(decks),
    fixtureMap: resolveFixtureMap(new Set(decks.map((deck) => deck.id)), fixtureMap),
    features: buildCoverageRows(),
  })
}

module.exports = {
  CORPUS_MANIFEST_SCHEMA_VERSION,
  buildCorpusManifest,
  buildCoverageRows,
  canonicalFixtureIds,
  hashFile,
  resolveFixtureMap,
}
