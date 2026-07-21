// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(
  os.tmpdir(),
  `navslides-history-package-lock-order-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const packageLifecycle = require('../services/package-lifecycle-integration')

let historyRouter
let packageHead
let beforeRetainHead
let presentationLockDepth = 0
let originalWithPresentations
const originalLifecycleMethods = {}
const lifecycleMethods = [
  'getRestorablePackageHead',
  'releasePackageOwner',
  'releasePackageOwnerWithRetry',
  'retainPackageHead',
  'restorePackageForward',
]

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/presentations', historyRouter)
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({ error: error.message, code: error.code })
  })
  return app
}

beforeAll(() => {
  originalWithPresentations = storage.withPresentations
  storage.withPresentations = async (action) =>
    originalWithPresentations(async (presentations) => {
      presentationLockDepth += 1
      try {
        return await action(presentations)
      } finally {
        presentationLockDepth -= 1
      }
    })

  for (const method of lifecycleMethods) {
    originalLifecycleMethods[method] = packageLifecycle[method]
    packageLifecycle[method] = async (...args) => {
      if (presentationLockDepth > 0) {
        throw new Error(`Package lifecycle ${method} ran under the presentations lock`)
      }
      if (method === 'retainPackageHead' && beforeRetainHead) {
        const advanceHead = beforeRetainHead
        beforeRetainHead = null
        await advanceHead()
      }
      return originalLifecycleMethods[method](...args)
    }
  }

  delete require.cache[require.resolve('./history')]
  historyRouter = require('./history')
})

afterAll(async () => {
  delete require.cache[require.resolve('./history')]
  storage.withPresentations = originalWithPresentations
  for (const method of lifecycleMethods) {
    packageLifecycle[method] = originalLifecycleMethods[method]
  }
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { force: true, recursive: true })
})

describe('package-backed history lock order', () => {
  beforeEach(async () => {
    beforeRetainHead = null
    presentationLockDepth = 0
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deck-1', title: 'Original', slides: [{ id: 'slide-1' }] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    await packageRuntime.withPackageStore(async (store) => {
      packageHead = await store.commitOriginal(Buffer.from('history-package'), {
        ownerType: 'presentation',
        ownerId: 'deck-1',
      })
    })
    await storage.withPresentations((presentations) => {
      presentations[0].pptxAggregateHead = packageHead
    })
  })

  afterEach(async () => {
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  it('runs package lifecycle work outside presentation serialization for snapshot and restore', async () => {
    const app = makeApp()
    const snapshot = await request(app)
      .post('/api/presentations/deck-1/snapshot')
      .send({ name: 'Package-backed' })

    expect(snapshot.status).toBe(200)

    await storage.writePresentations([
      {
        id: 'deck-1',
        title: 'Changed',
        slides: [{ id: 'slide-1' }, { id: 'slide-2' }],
        pptxAggregateHead: packageHead,
      },
    ])

    const restored = await request(app)
      .post(`/api/presentations/deck-1/restore/${snapshot.body.id}`)

    expect(restored.status).toBe(200)
    expect((await storage.readPresentations())[0]).toMatchObject({
      title: 'Original',
      pptxAggregateHead: { generation: 2 },
    })
  })

  it('rejects a snapshot when its authoritative package head becomes stale', async () => {
    beforeRetainHead = async () => {
      await packageRuntime.withPackageStore((store) => store.mutate((next) => {
        next.heads.find((head) => head.presentationId === 'deck-1').generation += 1
      }))
    }

    const response = await request(makeApp())
      .post('/api/presentations/deck-1/snapshot')
      .send({ name: 'stale' })

    expect(response).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
    const files = await fs.readdir(path.join(storage.HISTORY_DIR, 'deck-1'))
    expect(files.filter((file) => file.endsWith('.json'))).toEqual([])
    await packageRuntime.withPackageStore((store) => {
      expect(store.getState().owners.filter((owner) => owner.ownerType === 'history')).toEqual([])
    })
  })

  it('rejects restore when its pre-restore snapshot head becomes stale', async () => {
    const app = makeApp()
    const snapshot = await request(app)
      .post('/api/presentations/deck-1/snapshot')
      .send({ name: 'restore target' })
    expect(snapshot.status).toBe(200)

    beforeRetainHead = async () => {
      await packageRuntime.withPackageStore((store) => store.mutate((next) => {
        next.heads.find((head) => head.presentationId === 'deck-1').generation += 1
      }))
    }
    const response = await request(app)
      .post(`/api/presentations/deck-1/restore/${snapshot.body.id}`)

    expect(response).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
    const files = await fs.readdir(path.join(storage.HISTORY_DIR, 'deck-1'))
    expect(files.filter((file) => file.endsWith('.json'))).toEqual([
      `${snapshot.body.id}.json`,
    ])
    await packageRuntime.withPackageStore((store) => {
      expect(store.getState().owners.filter((owner) => owner.ownerType === 'history')).toHaveLength(1)
    })
  })
})
