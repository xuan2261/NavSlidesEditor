// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import fs from 'fs-extra'
import path from 'node:path'
import { binary, reset, root, roots, sourceArchive } from './portable-package-project-fixture.js'

const require = createRequire(import.meta.url)
const previousData = process.env.SLIDES_DATA_DIR
const previousUploads = process.env.SLIDES_UPLOADS_DIR
let runtime, storage, store, app, original

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(async () => {
  const fixture = await sourceArchive(false)
  original = fixture.original
  const directory = await root()
  process.env.SLIDES_DATA_DIR = path.join(directory, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(directory, 'uploads')
  reset()
  storage = require('../services/storage')
  storage.initDataFiles()
  runtime = require('../services/pptx-import/package-store-runtime')
  store = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
  app = express()
  app.use(express.json())
  app.use('/api/presentations', require('./presentations-crud'))
  app.use('/api/presentations', require('./presentations-pptx'))
})

afterEach(async () => {
  try { await runtime?.shutdownPackageStore() } finally {
    runtime = undefined
    for (const directory of roots.splice(0)) await fs.remove(directory)
    if (previousData === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = previousData
    if (previousUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
    else process.env.SLIDES_UPLOADS_DIR = previousUploads
    reset()
  }
})

async function seed(id, projected = true) {
  const projection = { id, title: id, theme: 'white', slides: [] }
  if (projected) {
    await runtime.withPackageStore((current) => current.commitImport(original, {
      jobId: `import-${id}`, presentationId: id, projection,
      sourceMap: { entries: {} }, compatibilityPresentation: projection,
    }))
    await runtime.drainPackageCompatibilityOutbox()
  } else {
    await runtime.withPackageStore((current) => current.commitOriginal(original, {
      ownerType: 'presentation', ownerId: id,
    }))
    const head = store.getState().heads.find((item) => item.presentationId === id)
    await storage.withPresentations((rows) => rows.push({ ...projection, pptxAggregateHead: head }))
  }
  return (await storage.readPresentations()).find((row) => row.id === id)
}

async function expectReadable(id) {
  const deck = await request(app).get(`/api/presentations/${id}`)
  expect(deck.status).toBe(200)
  const bytes = await binary(request(app).get(`/api/presentations/${id}/pptx-original`))
  expect(bytes.status).toBe(200)
  expect(bytes.body).toEqual(original)
}

describe('restore authority publication HTTP consumers', () => {
  it.each(['projected', 'Original-only'])('keeps unrelated GET and Original readable after restore prepare failure and writer reopen (%s)', async (kind) => {
    await seed('restore-source')
    const unrelated = await seed('unrelated', kind === 'projected')
    const history = { ownerType: 'history', ownerId: 'restore-source:snapshot' }
    await runtime.withPackageStore((current) => current.retainHead(history, 'restore-source'))
    await expectReadable('unrelated')
    const epoch = store.getState().matrixAuthorityEpoch
    await expect(runtime.withPackageStore((current) => current.restoreForward('restore-source', history, {
      faultAfterPrepare: true,
    }))).rejects.toThrow()
    await runtime.shutdownPackageStore()
    store = await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    expect(store.getState().matrixAuthorityEpoch).toBeGreaterThan(epoch)
    await runtime.drainPackageCompatibilityOutbox()
    await expectReadable('unrelated')
    const row = (await storage.readPresentations()).find((item) => item.id === 'unrelated')
    expect(row.slides).toEqual(unrelated.slides)
    expect(row.title).toBe(unrelated.title)
    expect(row.pptxAggregateHead).toEqual(store.getState().heads.find((head) => head.presentationId === 'unrelated'))
  })

  it('does not publish an in-flight template destination during unrelated restore and resumes exactly one readable row', async () => {
    const source = await seed('template-source')
    const other = await seed('restore-source')
    const templateId = 'retained-template'
    const template = { ownerType: 'template', ownerId: templateId }
    const history = { ownerType: 'history', ownerId: 'restore-source:snapshot' }
    await runtime.withPackageStore((current) => current.retainHead(template, source.id))
    await runtime.withPackageStore((current) => current.retainHead(history, other.id))
    await storage.writeTemplates([{ ...source, id: templateId, isTemplate: true }])
    const lifecycle = require('../services/package-lifecycle-integration')
    const instantiate = lifecycle.instantiateRetainedPackageHead
    const entered = deferred()
    const resume = deferred()
    let destinationId, pending
    lifecycle.instantiateRetainedPackageHead = async (...args) => {
      const head = await instantiate(...args)
      destinationId = args[1]
      entered.resolve()
      await resume.promise
      return head
    }
    try {
      pending = request(app).post('/api/presentations').send({ templateId }).then((response) => response)
      await Promise.race([entered.promise, pending.then((response) => {
        throw new Error(`Template request completed before the publication barrier (${response.status})`)
      })])
      expect((await storage.readPresentations()).filter((row) => row.id === destinationId)).toEqual([])
      const owners = store.getState().owners.filter((owner) => owner.ownerType === 'template')
      await runtime.withPackageStore((current) => current.restoreForward(other.id, history, {
        compatibilityPresentation: other,
      }))
      await runtime.drainPackageCompatibilityOutbox()
      const during = (await storage.readPresentations()).filter((row) => row.id === destinationId)
      const duringGet = await request(app).get(`/api/presentations/${destinationId}`)
      resume.resolve()
      const response = await pending
      expect(during).toEqual([])
      expect(duringGet.status).toBe(404)
      expect(response.status).toBe(201)
      const rows = (await storage.readPresentations()).filter((row) => row.id === destinationId)
      expect(rows).toHaveLength(1)
      expect(store.getState().owners.filter((owner) => owner.ownerType === 'template')).toEqual(owners)
      await runtime.drainPackageCompatibilityOutbox()
      await expectReadable(destinationId)
    } finally {
      resume.resolve()
      lifecycle.instantiateRetainedPackageHead = instantiate
      await pending
    }
  })
})
