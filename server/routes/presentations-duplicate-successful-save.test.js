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
  `navslides-duplicate-successful-save-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const packageLifecycle = require('../services/package-lifecycle-integration')
const { hashRecord, SCHEMA_VERSION } = require('../services/pptx-import/package-store/schemas')

function deferred() {
  let resolve
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

let presentationsRouter
let duplicateEntered
let duplicateGate
let originalDuplicatePackageOwner

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/presentations', presentationsRouter)
  return app
}

async function seedCommittedAuthority() {
  let packageHead
  await packageRuntime.withPackageStore(async (store) => {
    const source = store.getState().heads.find((head) => head.presentationId === 'deck-1')
    const projection = { id: 'deck-1', title: 'Original', slides: [{ id: 's1', elements: [] }] }
    const sourceMap = {
      schemaVersion: SCHEMA_VERSION,
      presentationId: 'deck-1',
      revisionId: source.packageRevisionId,
      packageGeneration: source.generation,
      entries: {},
    }
    await store.mutate((next) => {
      const head = next.heads.find((item) => item.presentationId === 'deck-1')
      head.projectionRevisionId = hashRecord(projection)
      head.sourceMapRevisionId = hashRecord(sourceMap)
      next.mutationResults.push({
        schemaVersion: SCHEMA_VERSION,
        operation: 'package-import',
        presentationId: 'deck-1',
        idempotencyKey: 'fixture-import',
        generation: source.generation,
        packageRevisionId: source.packageRevisionId,
        projection,
        sourceMap,
        state: 'committed',
      })
    })
    packageHead = store.getState().heads.find((head) => head.presentationId === 'deck-1')
  })
  await storage.withPresentations((presentations) => {
    presentations[0].pptxAggregateHead = packageHead
  })
}

beforeAll(() => {
  originalDuplicatePackageOwner = packageLifecycle.duplicatePackageOwner
  packageLifecycle.duplicatePackageOwner = async (...args) => {
    if (!duplicateGate) return originalDuplicatePackageOwner(...args)
    duplicateEntered.resolve()
    await duplicateGate.promise
    return originalDuplicatePackageOwner(...args)
  }
  delete require.cache[require.resolve('./presentations')]
  presentationsRouter = require('./presentations')
})

afterAll(async () => {
  delete require.cache[require.resolve('./presentations')]
  packageLifecycle.duplicatePackageOwner = originalDuplicatePackageOwner
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { force: true, recursive: true })
})

describe('duplicate against successful package save', () => {
  beforeEach(async () => {
    duplicateEntered = deferred()
    duplicateGate = null
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deck-1', title: 'Original', slides: [{ id: 's1', elements: [] }] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    await packageRuntime.withPackageStore((store) => store.commitOriginal(
      Buffer.from('original-package'),
      { ownerType: 'presentation', ownerId: 'deck-1' }
    ))
    await seedCommittedAuthority()
  })

  afterEach(async () => {
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  it('settles a stale duplicate after a successful concurrent package save', async () => {
    duplicateGate = deferred()
    const app = makeApp()
    expect((await request(app).get('/api/presentations/deck-1')).status).toBe(200)
    const duplicateRequest = request(app)
      .post('/api/presentations/deck-1/duplicate')
      .then((response) => response)
    await duplicateEntered.promise

    const save = await request(app)
      .put('/api/presentations/deck-1')
      .set('Idempotency-Key', 'duplicate-successful-save')
      .send({ aggregateGeneration: 1, slides: [{ id: 's1', elements: [] }] })
    duplicateGate.resolve()
    const duplicate = await duplicateRequest

    expect(save).toMatchObject({ status: 200, body: { aggregateGeneration: 2 } })
    expect(duplicate).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
  })
})
