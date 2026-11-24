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

const storage = require('../../server/services/storage')
const packageRuntime = require('../../server/services/pptx-import/package-store-runtime')
const packageLifecycle = require('../../server/services/package-lifecycle-integration')
const { hashRecord, RECORD_SCHEMA_VERSION } = require('../../server/services/pptx-import/package-store/schemas')

function deferred() {
  let resolve
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

let presentationsRouter
let duplicateEntered
let duplicateGate
let originalDuplicatePackageOwner
let drainGate, drainEntered, originalDrain

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
      schemaVersion: RECORD_SCHEMA_VERSION,
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
        schemaVersion: RECORD_SCHEMA_VERSION,
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
  originalDrain = packageRuntime.drainPackageCompatibilityOutbox
  packageRuntime.drainPackageCompatibilityOutbox = async (...args) => { await originalDrain(...args); if (drainGate) { const gate = drainGate; drainGate = null; drainEntered.resolve(); await gate.promise } }
  originalDuplicatePackageOwner = packageLifecycle.duplicatePackageOwner
  packageLifecycle.duplicatePackageOwner = async (...args) => {
    if (!duplicateGate) return originalDuplicatePackageOwner(...args)
    duplicateEntered.resolve()
    await duplicateGate.promise
    return originalDuplicatePackageOwner(...args)
  }
  delete require.cache[require.resolve('../../server/routes/presentations')]
  presentationsRouter = require('../../server/routes/presentations')
})

afterAll(async () => {
  delete require.cache[require.resolve('../../server/routes/presentations')]
  packageLifecycle.duplicatePackageOwner = originalDuplicatePackageOwner
  packageRuntime.drainPackageCompatibilityOutbox = originalDrain
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { force: true, recursive: true })
})

describe('duplicate against successful package save', () => {
  beforeEach(async () => {
    drainGate = null
    drainEntered = deferred()
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

  it('detaches prepared replies from canonical, outbox, disk metadata and a second generation', async () => {
    const { savePackageProjection } = require('../../server/services/generation-safe-save')
    await storage.withPresentations((rows) => {
      rows[0]._pptxImportReport = { warnings: ['server-owned'] }
    })
    const save = (generation, title, key) => savePackageProjection({
      presentationId: 'deck-1', expectedGeneration: generation,
      idempotencyKey: key, after: { title, slides: [{ id: 's1', elements: [] }] },
      loadStored: async () => (await storage.readPresentations())[0],
    })
    const first = await save(1, 'First', 'isolated-first')
    expect(first.ok).toBe(true)
    first.responsePresentation.slides[0].elements.push({ id: 'reply-only' })
    first.responsePresentation._pptxImportReport.warnings.push('reply-only')
    first.responsePresentation.pptxAggregateHead.generation = 999
    expect(first.projection.slides[0].elements).toEqual([])
    const store = await packageRuntime.getReadablePackageStore()
    const writes = store.getCompatibilityState().compatibilityOutbox
    const write = writes.find((item) => item.generation === 2)
    expect(write.presentation.slides[0].elements).toEqual([])
    expect(write.presentation._pptxImportReport.warnings).toEqual(['server-owned'])
    write.presentation.slides[0].elements.push({ id: 'outbox-only' })
    write.presentation._pptxImportReport.warnings.push('outbox-only')
    await storage.withPresentations((rows) => {
      rows[0]._pptxImportReport.warnings.push('disk-only')
    })
    expect(first.responsePresentation._pptxImportReport.warnings).toEqual(['server-owned', 'reply-only'])
    const second = await save(2, 'Second', 'isolated-second')
    expect(second.ok).toBe(true)
    expect(second.responsePresentation.slides[0].elements).toEqual([])
    expect(second.responsePresentation._pptxImportReport.warnings).toEqual(['server-owned', 'disk-only'])
    expect(second.responsePresentation.pptxAggregateHead.generation).toBe(3)
    expect(first.responsePresentation.title).toBe('First')
    expect(store.getCompatibilityState().compatibilityOutbox.find((item) => item.generation === 2)
      .presentation._pptxImportReport.warnings).toEqual(['server-owned'])
  })

  it.each([false, true])('keeps receipt generation across successor (replay=%s)', async (replay) => {
    const app = makeApp()
    const body = { aggregateGeneration: 1, title: 'First', slides: [{ id: 's1', elements: [] }] }
    const save = () => request(app).put('/api/presentations/deck-1')
      .set('Idempotency-Key', 'first-save').send(body).then((response) => response)
    let first
    if (replay) { first = await save(); expect(first.status).toBe(200) }
    const gate = deferred()
    drainGate = gate
    const pending = save()
    await drainEntered.promise
    const successor = await request(app).put('/api/presentations/deck-1')
      .set('Idempotency-Key', 'successor-save')
      .send({ aggregateGeneration: 2, title: 'Successor', slides: [{ id: 's1', elements: [] }] })
    gate.resolve()
    const response = await pending
    expect(successor).toMatchObject({ status: 200, body: { title: 'Successor', aggregateGeneration: 3 } })
    expect(response).toMatchObject({ status: 200, body: {
      title: 'First', aggregateGeneration: 2,
      saveOutcome: replay ? 'idempotent-replay' : 'committed', pptxSourceAvailable: true,
    } })
    expect(response.body.pptxAggregateHead).toBeUndefined()
    if (replay) expect(response.body.updatedAt).toBe(first.body.updatedAt)
    const disk = (await storage.readPresentations())[0]
    expect(disk.title).toBe('Successor')
    expect(disk.pptxAggregateHead.generation).toBe(3)
    expect(await save()).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
  })

})
