// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
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

async function publishImport(jobId, title) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', `<p:presentation name="${title}" />`)
  const bytes = await zip.generateAsync({ type: 'nodebuffer' })
  const presentation = { id: 'race-destination', title, slides: [] }
  const result = await packageRuntime.withPackageStore((store) => store.commitImport(bytes, {
    jobId,
    presentationId: presentation.id,
    projection: presentation,
    sourceMap: { entries: {} },
    compatibilityPresentation: presentation,
  }))
  return { ...result, bytes }
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
  it.each(['upsert', 'remove'])(
    'P08-14: rejects a captured %s after replacement at the same numeric generation',
    async (operation) => {
      await packageRuntime.drainPackageCompatibilityOutbox()
      const old = await publishImport('loser-job', 'Loser')
      if (operation === 'remove') {
        await packageRuntime.drainPackageCompatibilityOutbox()
        await packageRuntime.withPackageStore((store) => store.quarantinePresentation(
          'race-destination', { compatibilityRemove: true }
        ))
      }
      const store = packageRuntime.getPackageStore()
      const stale = store.getState().compatibilityOutbox.find((write) =>
        write.presentationId === 'race-destination' && write.operation === operation
      )
      expect(stale).toBeTruthy()
      const locked = deferred()
      const releasePresentations = deferred()
      const captured = deferred()
      let winner
      let winnerWrite
      const holding = storage.withPresentations(async (rows) => {
        locked.resolve()
        await releasePresentations.promise
        if (operation === 'remove' && winnerWrite) {
          const index = rows.findIndex((row) => row.id === 'race-destination')
          rows[index] = structuredClone(winnerWrite.presentation)
        }
      })
      await locked.promise
      const getState = store.getState.bind(store)
      store.getState = () => {
        const state = getState()
        if (state.compatibilityOutbox.some((write) => write.id === stale.id)) captured.resolve()
        return state
      }
      let draining
      try {
        draining = packageRuntime.drainPackageCompatibilityOutbox()
        await captured.promise
        store.getState = getState
        if (operation === 'upsert') {
          await packageRuntime.withPackageStore((current) => current.rollbackImport({
            jobId: 'loser-job', presentationId: 'race-destination',
          }))
        }
        winner = await publishImport('winner-job', 'Winner')
        expect(winner.head.generation).toBe(old.head.generation)
        expect(winner.head.packageRevisionId).not.toBe(old.head.packageRevisionId)
        winnerWrite = store.getState().compatibilityOutbox.find((write) =>
          write.operation === 'upsert' &&
          write.presentation?.pptxAggregateHead?.packageRevisionId === winner.head.packageRevisionId
        )
        releasePresentations.resolve()
        await Promise.all([holding, draining])
      } finally {
        store.getState = getState
        releasePresentations.resolve()
        await Promise.allSettled([holding, draining].filter(Boolean))
      }

      const row = (await storage.readPresentations()).find((item) => item.id === 'race-destination')
      if (operation === 'upsert') expect(row).toBeUndefined()
      else expect(row).toMatchObject({ title: 'Winner', pptxAggregateHead: winner.head })
      const state = store.getState()
      expect(state.heads.find((head) => head.presentationId === 'race-destination')).toEqual(winner.head)
      expect(state.compatibilityOutbox).toEqual(expect.arrayContaining([winnerWrite]))
      expect(state.owners).toEqual(expect.arrayContaining([
        expect.objectContaining({ ownerId: 'race-destination', revisionId: winner.revision.id }),
      ]))
      await packageRuntime.drainPackageCompatibilityOutbox()
      const { readAuthoritativePresentation } = require('../package-backed-presentation-read')
      const opened = await readAuthoritativePresentation('race-destination', { normalize: false })
      expect(opened.presentation).toMatchObject({ title: 'Winner', pptxAggregateHead: winner.head })
      expect(await store.readOriginal(winner.head.originalRevisionId)).toEqual(winner.bytes)
      expect(await store.readOriginal(old.head.originalRevisionId)).toEqual(old.bytes)
    },
    5_000
  )
  it('P08-05: apply success followed by acknowledgement I/O failure replays without another business outcome', async () => {
    await packageRuntime.drainPackageCompatibilityOutbox()
    const committed = await publishImport('ack-retry-job', 'Acknowledgement retry')
    const store = packageRuntime.getPackageStore()
    const before = store.getState()
    const originalRename = fs.rename
    fs.rename = async (source, destination) => {
      if (path.resolve(destination) === path.resolve(store.metadata.rootPath)) {
        throw Object.assign(new Error('acknowledgement root unavailable'), { code: 'EIO' })
      }
      return originalRename(source, destination)
    }
    try {
      await expect(packageRuntime.drainPackageCompatibilityOutbox())
        .rejects.toMatchObject({ code: 'EIO' })
    } finally {
      fs.rename = originalRename
    }
    const appliedRows = await storage.readPresentations()
    expect(appliedRows.find((row) => row.id === 'race-destination'))
      .toMatchObject({ title: 'Acknowledgement retry', pptxAggregateHead: committed.head })
    expect(store.getState().compatibilityOutbox).toEqual(before.compatibilityOutbox)
    expect(store.getState().jobs).toEqual(before.jobs)
    await packageRuntime.drainPackageCompatibilityOutbox()
    expect(await storage.readPresentations()).toEqual(appliedRows)
    const after = store.getState()
    expect(after.compatibilityOutbox).toEqual([])
    expect(after.heads).toEqual(before.heads)
    expect(after.jobs).toEqual(before.jobs)
    expect(after.owners).toEqual(before.owners)
    expect(after.mutationResults).toEqual(before.mutationResults)
    expect(await store.readOriginal(committed.head.originalRevisionId)).toEqual(committed.bytes)
  }, 5_000)
})
