// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'

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
let failNextResponseJson
let originalDuplicatePackageOwner

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
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message })
  })
  return app
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

describe('package-backed duplicate races', () => {
  beforeEach(async () => {
    duplicateEntered = deferred()
    duplicateGate = null
    failNextResponseJson = false
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deck-1', title: 'Original', slides: [{ id: 's1', elements: [] }] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const projection = (await storage.readPresentations())[0]
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    zip.file('ppt/presentation.xml', '<p:presentation/>')
    await packageRuntime.withPackageStore(async (store) => store.commitImport(
      await zip.generateAsync({ type: 'nodebuffer' }), {
        jobId: 'fixture-import', presentationId: projection.id, projection,
        sourceMap: await require('../services/pptx-import/source-map').buildImportSourceMap(projection, null, null),
        compatibilityPresentation: projection,
      }
    ))
    await packageRuntime.drainPackageCompatibilityOutbox()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  it('releases presentation serialization before package duplication', async () => {
    await storage.withPresentations((presentations) => {
      presentations.push({ id: 'other-deck', title: 'Other', slides: [] })
    })
    duplicateGate = deferred()
    const app = makeApp()
    const duplicateRequest = request(app)
      .post('/api/presentations/deck-1/duplicate')
      .then((response) => response)
    await duplicateEntered.promise

    try {
      const save = await request(app)
        .put('/api/presentations/other-deck')
        .send({ title: 'Saved while duplication waits' })
      expect(save.status).toBe(200)
      expect(save.body.title).toBe('Saved while duplication waits')
    } finally {
      duplicateGate.resolve()
    }
    const duplicate = await duplicateRequest
    expect(duplicate.status).toBe(201)
  })

  it('keeps a published duplicate when response serialization fails', async () => {
    failNextResponseJson = true

    const response = await request(makeApp()).post('/api/presentations/deck-1/duplicate')

    expect(response.status).toBe(500)
    expect(response.body.error).toBe('injected response serialization failure')
    const presentations = await storage.readPresentations()
    expect(presentations).toHaveLength(2)
    const ids = presentations.map((presentation) => presentation.id).sort()
    await packageRuntime.withPackageStore((store) => {
      expect(store.getState().heads.map((head) => head.presentationId).sort()).toEqual(ids)
    })
  })
})
