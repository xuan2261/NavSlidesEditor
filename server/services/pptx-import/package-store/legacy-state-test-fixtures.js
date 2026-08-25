const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hashRecord(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')
}

// Normative fixtures model the smallest historical package-store chain; adversarial
// variants intentionally violate one contract and are safe to use in rejection tests.
function legacyHead(overrides = {}) {
  return {
    schemaVersion: 1,
    presentationId: 'legacy-deck',
    originalRevisionId: 'r0-legacy',
    packageRevisionId: 'r0-legacy',
    projectionRevisionId: 'projection-legacy',
    sourceMapRevisionId: 'source-map-legacy',
    evidenceByClaim: {},
    generation: 1,
    predecessorId: null,
    fencingEpoch: 1,
    ...overrides,
  }
}

function legacyState(overrides = {}) {
  return {
    schemaVersion: 1,
    generation: 1,
    fencingEpoch: 1,
    blobs: [],
    revisions: [],
    heads: [legacyHead()],
    owners: [],
    leases: [],
    jobs: [],
    mutationResults: [],
    compatibilityOutbox: [],
    compatibilityDeadLetter: [],
    candidateBlobs: [],
    ...overrides,
  }
}

function historicalPackageStoreFixture(overrides = {}) {
  const state = overrides.state ?? legacyState()
  return {
    state,
    stateHash: hashRecord(state),
    rootOverrides: { transactionId: 'legacy-transaction-0001', ...overrides.rootOverrides },
  }
}

function adversarialPackageStoreFixtures() {
  return {
    badHash: historicalPackageStoreFixture({ rootOverrides: { stateHash: '0'.repeat(64) } }),
    missingStructuralField: historicalPackageStoreFixture({ state: (() => {
      const state = legacyState()
      delete state.heads
      return state
    })() }),
    mixedAuthority: historicalPackageStoreFixture({ state: legacyState({
      heads: [legacyHead(), legacyHead({ schemaVersion: 2, matrixAuthorityEpoch: 1 })],
    }) }),
    unsupportedFutureVersion: historicalPackageStoreFixture({ state: legacyState({ schemaVersion: 99 }) }),
    mixedPredecessorShapes: historicalPackageStoreFixture({ rootOverrides: {
      predecessor: { schemaVersion: 1, stateHash: 'a'.repeat(64), stateFile: 'indexes/legacy.json' },
    } }),
  }
}

async function writeStateFixture(rootDir, state, rootOverrides = {}) {
  const stateHash = hashRecord(state)
  const stateFile = path.join('indexes', `${stateHash}.json`)
  await Promise.all([
    fs.mkdir(path.join(rootDir, 'indexes'), { recursive: true }),
    fs.mkdir(path.join(rootDir, 'wal'), { recursive: true }),
    fs.mkdir(path.join(rootDir, 'quarantine'), { recursive: true }),
  ])
  await fs.writeFile(path.join(rootDir, stateFile), JSON.stringify(state))
  const root = {
    schemaVersion: 1,
    transactionId: 'legacy-transaction-0001',
    stateHash,
    stateFile,
    storeGeneration: state.generation,
    fencingEpoch: state.fencingEpoch,
    predecessor: null,
    ...rootOverrides,
  }
  await fs.writeFile(path.join(rootDir, 'state-root.json'), JSON.stringify(root))
  return { root, state, stateHash }
}

module.exports = {
  hashRecord,
  legacyHead,
  legacyState,
  historicalPackageStoreFixture,
  adversarialPackageStoreFixtures,
  writeStateFixture,
}
