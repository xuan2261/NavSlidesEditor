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
  `navslides-history-delete-compensation-${process.pid}-${Date.now()}`
)
process.env.SLIDES_DATA_DIR = dataDir

const storage = require('../services/storage')
const fsExtra = require('fs-extra')
const packageRuntime = require('../services/pptx-import/package-store-runtime')
const packageLifecycle = require('../services/package-lifecycle-integration')

let historyRouter
let failRelease
let failOwnerQuery
let originalReleasePackageOwnerWithRetry
let originalPackageOwnerExists

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
  originalReleasePackageOwnerWithRetry = packageLifecycle.releasePackageOwnerWithRetry
  originalPackageOwnerExists = packageLifecycle.packageOwnerExists
  packageLifecycle.releasePackageOwnerWithRetry = async (...args) => {
    if (failRelease) throw new Error('injected history owner release failure')
    return originalReleasePackageOwnerWithRetry(...args)
  }
  packageLifecycle.packageOwnerExists = async (...args) => {
    if (failOwnerQuery) throw new Error('injected history owner query failure')
    return originalPackageOwnerExists(...args)
  }
  delete require.cache[require.resolve('./history')]
  historyRouter = require('./history')
})

afterAll(async () => {
  delete require.cache[require.resolve('./history')]
  packageLifecycle.releasePackageOwnerWithRetry = originalReleasePackageOwnerWithRetry
  packageLifecycle.packageOwnerExists = originalPackageOwnerExists
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.rm(dataDir, { force: true, recursive: true })
})

describe('history snapshot deletion compensation', () => {
  beforeEach(async () => {
    failRelease = false
    failOwnerQuery = false
    await packageRuntime.shutdownPackageStore()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: 'deck-1', title: 'Original', slides: [{ id: 's1', elements: [] }] },
    ])
    await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const packageHead = await packageRuntime.withPackageStore((store) =>
      store.commitOriginal(Buffer.from('history-package'), {
        ownerType: 'presentation',
        ownerId: 'deck-1',
      })
    )
    await storage.withPresentations((presentations) => {
      presentations[0].pptxAggregateHead = packageHead
    })
  })

  afterEach(async () => {
    await packageRuntime.shutdownPackageStore()
    await fs.rm(dataDir, { force: true, recursive: true })
    await fs.mkdir(dataDir, { recursive: true })
  })

  it('preserves a snapshot when package release status is unknown', async () => {
    const app = makeApp()
    const snapshot = await request(app)
      .post('/api/presentations/deck-1/snapshot')
      .send({ name: 'recoverable' })
    expect(snapshot.status).toBe(200)

    failRelease = true
    failOwnerQuery = true
    const response = await request(app)
      .delete(`/api/presentations/deck-1/snapshots/${snapshot.body.id}`)

    expect(response.status).toBe(500)
    const filePath = path.join(storage.HISTORY_DIR, 'deck-1', `${snapshot.body.id}.json`)
    await expect(fsExtra.readJson(filePath)).resolves.toMatchObject({
      id: snapshot.body.id,
      packageReleasePending: true,
    })
    await packageRuntime.withPackageStore((store) => {
      expect(store.getState().owners).toEqual(expect.arrayContaining([
        expect.objectContaining({
          ownerType: 'history',
          ownerId: `deck-1:${snapshot.body.id}`,
        }),
      ]))
    })
  })
})
