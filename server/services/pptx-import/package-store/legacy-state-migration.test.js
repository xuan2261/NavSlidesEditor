import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { openPackageStore } = require('./index')
const {
  legacyHead,
  legacyState,
  historicalPackageStoreFixture,
  adversarialPackageStoreFixtures,
  writeStateFixture,
} = require('./legacy-state-test-fixtures')
const { initializePackageStore, shutdownPackageStore } = require('../package-store-runtime')

const roots = []

async function fixtureRoot() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-legacy-state-'))
  roots.push(rootDir)
  return rootDir
}

async function readRoot(rootDir) {
  return JSON.parse(await fs.readFile(path.join(rootDir, 'state-root.json'), 'utf8'))
}

function currentState(headOverrides = {}, stateOverrides = {}) {
  const matrixAuthorityEpoch = stateOverrides.matrixAuthorityEpoch || 1
  return legacyState({
    schemaVersion: 2,
    matrixAuthorityEpoch,
    heads: [legacyHead({
      schemaVersion: 2,
      matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, matrixAuthorityEpoch),
      ...headOverrides,
    })],
    ...stateOverrides,
  })
}

afterEach(async () => {
  await shutdownPackageStore()
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('package-store legacy state migration', () => {

  it('provides deterministic normative and adversarial baseline fixture variants', () => {
    const normative = historicalPackageStoreFixture()
    const adversarial = adversarialPackageStoreFixtures()
    expect(normative.state).toEqual(legacyState())
    expect(normative.stateHash).toBe(require('./legacy-state-test-fixtures').hashRecord(normative.state))
    expect(Object.keys(adversarial)).toEqual([
      'badHash',
      'missingStructuralField',
      'mixedAuthority',
      'unsupportedFutureVersion',
      'mixedPredecessorShapes',
    ])
    expect(adversarial.badHash.rootOverrides.stateHash).toHaveLength(64)
    expect(adversarial.missingStructuralField.state).not.toHaveProperty('heads')
  })
  it('opens an exact pre-authority schema-1 state in memory without publishing', async () => {
    const rootDir = await fixtureRoot()
    const fixture = await writeStateFixture(rootDir, legacyState())

    const store = await openPackageStore({ rootDir })

    expect(store.getState()).toMatchObject({
      schemaVersion: 2,
      generation: 1,
      matrixAuthorityEpoch: 1,
      heads: [{
        schemaVersion: 2,
        presentationId: 'legacy-deck',
        matrixAuthorityEpoch: 1,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 1),
      }],
    })
    expect(store.metadata.pendingMigration).toMatchObject({ migratedFrom: 'pre-authority-v1' })
    expect(await readRoot(rootDir)).toEqual(fixture.root)
    expect(store.metadata.pendingHighWaterPersist).toBe(true)
    await expect(fs.access(path.join(rootDir, 'matrix-authority-epoch-high-water.json')))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('publishes one durable version-2 successor only after writer acquisition', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, legacyState())
    const store = await openPackageStore({ rootDir })

    await store.acquireWriter()
    const publishedRoot = await readRoot(rootDir)
    expect(publishedRoot.schemaVersion).toBe(2)
    expect(publishedRoot.predecessor).toMatchObject({ schemaVersion: 1 })
    expect(store.recoveryActions).toEqual(expect.arrayContaining([
      'loaded-legacy-state-v1',
      'published-state-migration-v2',
    ]))
    await store.releaseWriter()

    const reopened = await openPackageStore({ rootDir })
    expect(reopened.metadata.pendingMigration).toBeNull()
    expect(reopened.getState()).toMatchObject({ schemaVersion: 2, generation: 1 })
    expect(reopened.recoveryActions).not.toContain('loaded-legacy-state-v1')
  })

  it.each([
    ['state-only epoch', legacyState({ matrixAuthorityEpoch: 1 })],
    ['one current head among legacy heads', legacyState({
      heads: [legacyHead(), legacyHead({
        presentationId: 'mixed-deck',
        matrixAuthorityEpoch: 1,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 1),
      })],
    })],
    ['future state version', legacyState({ schemaVersion: 99 })],
  ])('rejects ambiguous or unsupported legacy shape: %s', async (_name, state) => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, state)

    await expect(openPackageStore({ rootDir })).rejects.toThrow()
  })

  it('derives the migrated epoch from a valid high-water record', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, legacyState())
    await fs.writeFile(path.join(rootDir, 'matrix-authority-epoch-high-water.json'), JSON.stringify({
      schemaVersion: 1,
      matrixAuthorityEpoch: 7,
    }))

    const store = await openPackageStore({ rootDir })

    expect(store.getState().matrixAuthorityEpoch).toBe(7)
    expect(store.getState().heads[0]).toMatchObject({
      matrixAuthorityEpoch: 7,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 7),
    })
  })

  it('migrates valid schema-1 authority metadata without regressing its epoch', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, legacyState({
      matrixAuthorityEpoch: 4,
      heads: [legacyHead({
        matrixAuthorityEpoch: 4,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 4),
      })],
    }))

    const store = await openPackageStore({ rootDir })

    expect(store.metadata.pendingMigration).toMatchObject({ migratedFrom: 'authority-v1' })
    expect(store.getState().heads[0]).toMatchObject({
      schemaVersion: 2,
      matrixAuthorityEpoch: 4,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 4),
    })
  })

  it.each([
    ['mismatched authority epochs', legacyState({
      matrixAuthorityEpoch: 3,
      heads: [legacyHead({
        matrixAuthorityEpoch: 2,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 2),
      })],
    })],
    ['corrupt authority subjects', legacyState({
      matrixAuthorityEpoch: 2,
      heads: [legacyHead({ matrixAuthorityEpoch: 2, matrixAuthoritySubjects: {} })],
    })],
    ['unknown nested authority subject fields', (() => {
      const subjects = structuredClone(createMatrixAuthoritySubjects(undefined, 2))
      subjects.qualification.extra = true
      return legacyState({
        matrixAuthorityEpoch: 2,
        heads: [legacyHead({ matrixAuthorityEpoch: 2, matrixAuthoritySubjects: subjects })],
      })
    })()],
    ['unknown authority subject map fields', (() => {
      const subjects = structuredClone(createMatrixAuthoritySubjects(undefined, 2))
      subjects.extra = subjects.qualification
      return legacyState({
        matrixAuthorityEpoch: 2,
        heads: [legacyHead({ matrixAuthorityEpoch: 2, matrixAuthoritySubjects: subjects })],
      })
    })()],
    ['stray head authority fields', legacyState({
      heads: [legacyHead({ matrixAuthorityDigest: 'unknown' })],
    })],
    ['stray state authority fields', legacyState({ matrixAuthoritySubjects: {} })],
  ])('rejects invalid legacy authority metadata: %s', async (_name, state) => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, state)
    await expect(openPackageStore({ rootDir })).rejects.toThrow()
  })

  it('rejects a bad legacy state hash and an invalid high-water record', async () => {
    const badHashRoot = await fixtureRoot()
    const badHashFixture = await writeStateFixture(badHashRoot, legacyState())
    const badHash = '0'.repeat(64)
    const badHashFile = path.join('indexes', `${badHash}.json`)
    await fs.copyFile(
      path.join(badHashRoot, badHashFixture.root.stateFile),
      path.join(badHashRoot, badHashFile)
    )
    await fs.writeFile(path.join(badHashRoot, 'state-root.json'), JSON.stringify({
      ...badHashFixture.root,
      stateHash: badHash,
      stateFile: badHashFile,
    }))
    await expect(openPackageStore({ rootDir: badHashRoot })).rejects.toThrow('hash mismatch')

    const badHighWaterRoot = await fixtureRoot()
    await writeStateFixture(badHighWaterRoot, legacyState())
    await fs.writeFile(path.join(badHighWaterRoot, 'matrix-authority-epoch-high-water.json'),
      JSON.stringify({ schemaVersion: 1, matrixAuthorityEpoch: 0 }))
    await expect(openPackageStore({ rootDir: badHighWaterRoot })).rejects.toThrow(
      'Invalid matrix authority high-water record'
    )
  })

  it.each([
    ['missing subjects', currentState({ matrixAuthoritySubjects: undefined })],
    ['corrupt subjects', currentState({ matrixAuthoritySubjects: {} })],
    ['stale subject epoch', currentState({
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 1),
    }, { matrixAuthorityEpoch: 2 })],
    ['state and head epoch mismatch', currentState({
      matrixAuthorityEpoch: 1,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, 1),
    }, { matrixAuthorityEpoch: 2 })],
    ['unknown subject map fields', (() => {
      const subjects = structuredClone(createMatrixAuthoritySubjects())
      subjects.extra = subjects.qualification
      return currentState({ matrixAuthoritySubjects: subjects })
    })()],
    ['stray head authority fields', currentState({ matrixAuthorityDigest: 'unknown' })],
    ['stray state authority fields', currentState({}, { matrixAuthoritySubjects: {} })],
  ])('rejects invalid current authority metadata: %s', async (_name, state) => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, state, { schemaVersion: 2 })
    await expect(openPackageStore({ rootDir })).rejects.toThrow()
  })

  it('rejects an unsupported root before attempting to read its index path', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, currentState(), {
      schemaVersion: 99,
      stateFile: path.join('..', 'missing-index.json'),
    })

    await expect(openPackageStore({ rootDir })).rejects.toThrow('Unsupported state root schema version')
  })

  it('selects and migrates a verified legacy predecessor when the current root is corrupt', async () => {
    const rootDir = await fixtureRoot()
    const { root: legacyRoot } = await writeStateFixture(rootDir, legacyState())
    const corruptRoot = {
      schemaVersion: 2,
      transactionId: 'corrupt-current-root',
      stateHash: 'f'.repeat(64),
      stateFile: path.join('indexes', 'missing-current.json'),
      storeGeneration: 2,
      fencingEpoch: 2,
      predecessor: legacyRoot,
    }
    await fs.writeFile(path.join(rootDir, 'state-root.json'), JSON.stringify(corruptRoot))

    const store = await openPackageStore({ rootDir })
    expect(store.getState()).toMatchObject({ schemaVersion: 2, generation: 1 })
    expect(store.recoveryActions).toEqual(expect.arrayContaining([
      'loaded-legacy-state-v1',
      'restored-verified-predecessor',
    ]))
    expect(store.metadata.pendingRootRecovery).toBe(true)
    expect(await readRoot(rootDir)).toEqual(corruptRoot)

    await store.acquireWriter()
    expect(await readRoot(rootDir)).toMatchObject({ schemaVersion: 2, predecessor: { schemaVersion: 1 } })
    await store.releaseWriter()
  })

  it('runtime initialization publishes the migration before returning the active store', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, legacyState())

    const store = await initializePackageStore({ rootDir })

    expect(store.metadata.pendingMigration).toBeNull()
    expect(await readRoot(rootDir)).toMatchObject({ schemaVersion: 2 })
    expect(store.recoveryActions).toEqual(expect.arrayContaining([
      'loaded-legacy-state-v1',
      'published-state-migration-v2',
    ]))
  })

  it('allows only one migration publisher across concurrent writer acquisition', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, legacyState())
    const first = await openPackageStore({ rootDir })
    const second = await openPackageStore({ rootDir })

    const attempts = await Promise.allSettled([first.acquireWriter(), second.acquireWriter()])
    const winner = attempts[0].status === 'fulfilled' ? first : second
    const loser = winner === first ? second : first
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    await winner.releaseWriter()

    const firstPublishedRoot = await readRoot(rootDir)
    await loser.acquireWriter()
    expect((await readRoot(rootDir)).transactionId).toBe(firstPublishedRoot.transactionId)
    await loser.releaseWriter()
  })

  it('reclaims an abandoned writer lock before publishing the migration', async () => {
    const rootDir = await fixtureRoot()
    await writeStateFixture(rootDir, legacyState())
    await fs.writeFile(path.join(rootDir, 'writer.lock'), JSON.stringify({
      schemaVersion: 2,
      nonce: 'abandoned',
      processInstanceId: 'previous-process-instance',
      host: os.hostname(),
      pid: process.pid,
      acquiredAt: '2026-08-21T00:00:00.000Z',
      epoch: 1,
    }))
    await fs.writeFile(path.join(rootDir, 'fencing-epoch.json'), JSON.stringify({ schemaVersion: 1, epoch: 1 }))
    const store = await openPackageStore({ rootDir })

    await store.acquireWriter()

    expect(store.fencingEpoch).toBe(2)
    expect(await readRoot(rootDir)).toMatchObject({ schemaVersion: 2, fencingEpoch: 2 })
    await store.releaseWriter()
  })

  it.each(['faultAfterIndex', 'faultAfterPrepare', 'faultAfterRoot', 'faultAfterCompletion'])(
    'converges after migration publication fault %s without a second successor',
    async (fault) => {
      const rootDir = await fixtureRoot()
      await writeStateFixture(rootDir, legacyState())
      const faulting = await openPackageStore({ rootDir })
      const publish = faulting.metadata.publish.bind(faulting.metadata)
      faulting.metadata.publish = (state, options) => publish(state, { ...options, [fault]: true })

      await expect(faulting.acquireWriter()).rejects.toThrow(`Injected fault`)

      const recovered = await openPackageStore({ rootDir })
      await recovered.acquireWriter()
      const root = await readRoot(rootDir)
      let currentVersionRoots = 0
      for (let candidate = root; candidate; candidate = candidate.predecessor) {
        if (candidate.schemaVersion === 2) currentVersionRoots += 1
      }
      expect(currentVersionRoots).toBe(1)
      expect(recovered.getState()).toMatchObject({ schemaVersion: 2, matrixAuthorityEpoch: 1 })
      await recovered.releaseWriter()
    }
  )
})
