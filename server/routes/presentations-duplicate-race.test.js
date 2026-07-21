// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const require = createRequire(import.meta.url)
const originalDataDir = process.env.SLIDES_DATA_DIR
const dataDir = path.join(
  os.tmpdir(),
  `navslides-duplicate-race-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const packageLifecycle = require('../services/package-lifecycle-integration')

function deferred() {
  let resolve
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

let presentationsRouter
let duplicateEntered
let duplicateGate
let duplicateSawPresentationLock
let failNextResponseJson
let observePutRead
let presentationLockDepth = 0
let putReadStarted
let originalDuplicatePackageOwner
let originalReadPresentations
let originalWithPresentations

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((_req, res, next) => {
    if (!failNextResponseJson) return next()
    failNextResponseJson = false
    const json = res.json.bind(res)
    let failed = false
    res.json = (...args) => {
      if (!failed) {
        failed = true
        throw new Error('injected response serialization failure')
      }
      return json(...args)
    }
    next()
  })
  app.use('/api/presentations', presentationsRouter)
  return app
}

beforeAll(() => {
  originalWithPresentations = storage.withPresentations
  originalReadPresentations = storage.readPresentations
  originalDuplicatePackageOwner = packageLifecycle.duplicatePackageOwner

  storage.withPresentations = async (action) =>
    originalWithPresentations(async (presentations) => {
      presentationLockDepth += 1
      try {
        return await action(presentations)
      } finally {
        presentationLockDepth -= 1
      }
    })
  storage.readPresentations = async (...args) => {
    if (observePutRead) {
      observePutRead = false
      putReadStarted.resolve()
    }
    return originalReadPresentations(...args)
  }
  packageLifecycle.duplicatePackageOwner = async (...args) => {
    if (!duplicateGate) return originalDuplicatePackageOwner(...args)
    duplicateSawPresentationLock = presentationLockDepth > 0
    duplicateEntered.resolve()
    await duplicateGate.promise
    if (duplicateSawPresentationLock) return null
    return originalDuplicatePackageOwner(...args)
  }

  delete require.cache[require.resolve('./presentations')]
  presentationsRouter = require('./presentations')
})

afterAll(async () => {
  delete require.cache[require.resolve('./presentations')]
  storage.withPresentations = originalWithPresentations
  storage.readPresentations = originalReadPresentations
  packageLifecycle.duplicatePackageOwner = originalDuplicatePackageOwner
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { force: true, recursive: true })
})

describe('package-backed duplicate races', () => {
  beforeEach(async () => {
    duplicateEntered = deferred()
    duplicateGate = null
    duplicateSawPresentationLock = false
    failNextResponseJson = false
    observePutRead = false
    presentationLockDepth = 0
    putReadStarted = deferred()
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deck-1', title: 'Original', slides: [{ id: 's1', elements: [] }] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const packageHead = await packageRuntime.withPackageStore((store) =>
      store.commitOriginal(Buffer.from('original-only-package'), {
        ownerType: 'presentation',
        ownerId: 'deck-1',
      })
    )
    await storage.withPresentations((presentations) => {
      presentations[0].pptxAggregateHead = packageHead
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  it('releases presentation serialization before package duplication', async () => {
    duplicateGate = deferred()
    const app = makeApp()
    const duplicateRequest = request(app)
      .post('/api/presentations/deck-1/duplicate')
      .then((response) => response)
    await duplicateEntered.promise

    observePutRead = true
    const saveRequest = request(app)
      .put('/api/presentations/deck-1')
      .set('Idempotency-Key', 'duplicate-lock-order')
      .send({ aggregateGeneration: 1, slides: [{ id: 's1', elements: [] }] })
      .then((response) => response)
    await putReadStarted.promise
    duplicateGate.resolve()

    const [duplicate, save] = await Promise.all([duplicateRequest, saveRequest])
    expect(duplicateSawPresentationLock).toBe(false)
    expect(duplicate.status).toBe(201)
    expect(save).toMatchObject({
      status: 422,
      body: { code: 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE' },
    })
  })

  it('keeps a published duplicate when response serialization fails', async () => {
    failNextResponseJson = true

    const response = await request(makeApp()).post('/api/presentations/deck-1/duplicate')

    expect(response.status).toBe(500)
    const presentations = await storage.readPresentations()
    expect(presentations).toHaveLength(2)
    const ids = presentations.map((presentation) => presentation.id).sort()
    await packageRuntime.withPackageStore((store) => {
      expect(store.getState().heads.map((head) => head.presentationId).sort()).toEqual(ids)
    })
  })
})
