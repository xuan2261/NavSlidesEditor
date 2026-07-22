// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(
  os.tmpdir(),
  `navslides-package-presentation-lock-order-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../storage')
const packageRuntime = require('./package-store-runtime')

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

describe('package compatibility replay lock order', () => {
  beforeEach(async () => {
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deleted-deck', title: 'Deleted', slides: [] },
      { id: 'history-deck', title: 'History', slides: [] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    await packageRuntime.withPackageStore(async (store) => {
      await store.commitOriginal(Buffer.from('deleted-package'), {
        ownerType: 'presentation',
        ownerId: 'deleted-deck',
      })
      await store.commitOriginal(Buffer.from('history-package'), {
        ownerType: 'presentation',
        ownerId: 'history-deck',
      })
      await store.quarantinePresentation('deleted-deck', { compatibilityRemove: true })
    })
  })

  afterEach(async () => {
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  afterAll(async () => {
    if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = originalDataDir
    await fs.rm(dataDir, { force: true, recursive: true })
  })

  it('serializes recovery reload behind direct package mutations', async () => {
    const store = packageRuntime.getPackageStore()
    const originalReadValidatedRoot = store.metadata.readValidatedRoot.bind(store.metadata)
    const rootRead = deferred()
    const allowRead = deferred()
    const owner = store.getState().owners.find((item) => item.ownerId === 'history-deck')
    const recoveryOwner = { ...owner, ownerId: 'history-deck:reload-race' }
    let failure
    let directMutation

    store.metadata.readValidatedRoot = async (root) => {
      rootRead.resolve()
      await allowRead.promise
      return originalReadValidatedRoot(root)
    }

    try {
      failure = packageRuntime.withPackageStore(async () => {
        throw new Error('action failed')
      }).catch((error) => error)
      await rootRead.promise

      directMutation = store.mutate((next) => {
        next.owners.push(recoveryOwner)
      })
      allowRead.resolve()

      expect(await failure).toMatchObject({ message: 'action failed' })
      await directMutation
      expect(store.getState().owners).toEqual(expect.arrayContaining([recoveryOwner]))
    } finally {
      allowRead.resolve()
      if (failure) await failure
      if (directMutation) await directMutation.catch(() => {})
      store.metadata.readValidatedRoot = originalReadValidatedRoot
    }
  })

  it('releases package serialization before replaying against a history-style lock', async () => {
    const presentationsLocked = deferred()
    const allowHistoryPackageWork = deferred()
    const historyEnteredPackageStore = deferred()

    const historyOperation = storage.withPresentations(async () => {
      presentationsLocked.resolve()
      await allowHistoryPackageWork.promise
      await packageRuntime.withPackageStore(async (store) => {
        await store.retainHead(
          { ownerType: 'history', ownerId: 'history-deck:lock-order' },
          'history-deck'
        )
        historyEnteredPackageStore.resolve()
      })
    })

    await presentationsLocked.promise

    let draining
    try {
      draining = packageRuntime.drainPackageCompatibilityOutbox()

      // This runs after the drain's package snapshot phase. If replay still
      // holds package serialization while it waits for presentations, this
      // barrier cannot pass and exposes the old lock inversion.
      await packageRuntime.withPackageStore(async () => {})

      allowHistoryPackageWork.resolve()
      await historyEnteredPackageStore.promise
      await Promise.all([historyOperation, draining])
    } finally {
      allowHistoryPackageWork.resolve()
      await historyOperation
      if (draining) await draining
    }

    expect(await storage.readPresentations()).toEqual([
      { id: 'history-deck', title: 'History', slides: [] },
    ])
    await packageRuntime.withPackageStore((store) => {
      expect(store.getState().compatibilityOutbox).toEqual([])
    })
  }, 5_000)
})
