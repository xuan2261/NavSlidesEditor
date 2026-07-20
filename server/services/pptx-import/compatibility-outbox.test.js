const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./package-store')
const {
  acknowledgeCompatibilityOutbox,
  drainCompatibilityOutbox,
  queueCompatibilityRemoval,
  queueCompatibilityUpsert,
  snapshotCompatibilityOutbox,
} = require('./compatibility-outbox')

const roots = []

async function createStore() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-compatibility-outbox-'))
  roots.push(rootDir)
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  return store
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe('package compatibility outbox', () => {
  it('keeps an unacknowledged write durable when applying it fails', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      queueCompatibilityUpsert(next, {
        presentationId: 'deck-1',
        generation: 2,
        presentation: { id: 'deck-1', title: 'Updated', slides: [] },
      })
    })

    await expect(drainCompatibilityOutbox(store, async () => {
      throw new Error('injected compatibility persistence failure')
    })).rejects.toThrow('injected compatibility persistence failure')

    expect(store.getState().compatibilityOutbox).toEqual([
      expect.objectContaining({
        operation: 'upsert',
        presentationId: 'deck-1',
        generation: 2,
      }),
    ])
    await store.releaseWriter()
  })

  it('acknowledges only writes successfully applied to the compatibility view', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      queueCompatibilityUpsert(next, {
        presentationId: 'deck-1',
        generation: 2,
        presentation: { id: 'deck-1', title: 'Updated', slides: [] },
      })
      queueCompatibilityRemoval(next, {
        presentationId: 'deck-2',
        generation: 3,
      })
    })
    const applied = []

    await expect(drainCompatibilityOutbox(store, async (writes) => {
      applied.push(...writes)
    })).resolves.toBe(2)

    expect(applied).toHaveLength(2)
    expect(store.getState().compatibilityOutbox).toEqual([])
    await store.releaseWriter()
  })

  it('acknowledges only the writes included in the applied snapshot', async () => {
    const store = await createStore()
    await store.mutate((next) => {
      queueCompatibilityUpsert(next, {
        presentationId: 'deck-1',
        generation: 2,
        presentation: { id: 'deck-1', title: 'Updated', slides: [] },
      })
    })
    const appliedWrites = snapshotCompatibilityOutbox(store)
    await store.mutate((next) => {
      queueCompatibilityRemoval(next, {
        presentationId: 'deck-2',
        generation: 3,
      })
    })

    await acknowledgeCompatibilityOutbox(store, appliedWrites)

    expect(store.getState().compatibilityOutbox).toEqual([
      expect.objectContaining({ operation: 'remove', presentationId: 'deck-2' }),
    ])
    await store.releaseWriter()
  })
})
