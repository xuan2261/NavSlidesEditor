// @vitest-environment node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import express from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const previousData = process.env.SLIDES_DATA_DIR
const previousUploads = process.env.SLIDES_UPLOADS_DIR
let root, storage, runtime, lifecycle, app, allocation

function clearServerModules() {
  const server = path.resolve('server') + path.sep
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(server)) delete require.cache[key]
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-destination-collision-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  clearServerModules()
  storage = require('../services/storage')
  storage.initDataFiles()
  runtime = require('../services/pptx-import/package-store-runtime')
  lifecycle = require('../services/package-lifecycle-integration')
  await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
  await runtime.withPackageStore(async store => {
    for (const id of ['source', 'winner']) {
      await store.commitOriginal(Buffer.from(`${id}-original`), { ownerType: 'presentation', ownerId: id })
    }
    await store.retainHead({ ownerType: 'template', ownerId: 'template' }, 'source')
    const state = store.getState()
    await storage.writePresentations(state.heads.map(head => ({
      id: head.presentationId, title: head.presentationId, slides: [], pptxAggregateHead: head,
    })))
    await storage.writeTemplates([{
      id: 'template', title: 'Template', slides: [], pptxAggregateHead: state.heads[0],
    }])
  })
  allocation = 'winner'
  require('./presentations-helpers').uuidv4 = () => allocation
  app = express()
  app.use(express.json())
  app.use('/api/presentations', require('./presentations-crud'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await runtime?.shutdownPackageStore()
  clearServerModules()
  if (previousData === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = previousData
  if (previousUploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = previousUploads
  if (root) await fs.rm(root, { recursive: true, force: true })
})

function create(kind) {
  return kind === 'template'
    ? request(app).post('/api/presentations').send({ templateId: 'template' })
    : request(app).post('/api/presentations/source/duplicate').send({})
}

async function snapshot() {
  return { state: (await runtime.getReadablePackageStore()).getState(), rows: await storage.readPresentations() }
}

async function expectPreserved(before) {
  await runtime.drainPackageCompatibilityOutbox()
  expect(await snapshot()).toEqual(before)
  const response = await request(app).get('/api/presentations/winner')
  expect(response).toMatchObject({ status: 200, body: { id: 'winner', title: 'winner' } })
  const head = before.state.heads.find(item => item.presentationId === 'winner')
  const store = await runtime.getReadablePackageStore()
  expect(await store.readOriginal(head.originalRevisionId)).toEqual(Buffer.from('winner-original'))
}

describe('destination admission and compensation through HTTP', () => {
  it.each(['template', 'duplicate'])('%s rejects a package destination collision without changing its authority', async kind => {
    const before = await snapshot()
    const response = await create(kind)
    expect(response).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
    await expectPreserved(before)
  })

  it.each(['template', 'duplicate'])('%s preserves a colliding package head even without a compatibility row', async kind => {
    await storage.withPresentations(rows => rows.splice(rows.findIndex(row => row.id === 'winner'), 1))
    const before = await snapshot()
    const response = await create(kind)
    expect(response).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
    await runtime.drainPackageCompatibilityOutbox()
    expect(await snapshot()).toEqual(before)
    const head = before.state.heads.find(item => item.presentationId === 'winner')
    expect(await (await runtime.getReadablePackageStore()).readOriginal(head.originalRevisionId)).toEqual(Buffer.from('winner-original'))
  })

  it.each(['template', 'duplicate'])('%s rejects a compatibility-row collision without overwriting the row', async kind => {
    allocation = 'plain-winner'
    await storage.withPresentations(rows => rows.push({ id: allocation, title: 'Plain winner', slides: [] }))
    const before = await snapshot()
    const response = await create(kind)
    expect(response).toMatchObject({ status: 409, body: { code: 'STALE_GENERATION' } })
    await expectPreserved(before)
  })

  it.each(['template', 'duplicate'])('%s compensates its own published head after a root publication failure', async kind => {
    allocation = 'new-destination'
    const name = kind === 'template' ? 'instantiateRetainedPackageHead' : 'duplicatePackageOwner'
    const original = lifecycle[name]
    vi.spyOn(lifecycle, name).mockImplementation((a, b, options) => original(a, b, { ...options, faultAfterRoot: true }))
    const before = await snapshot()
    const response = await create(kind)
    expect(response.status).toBe(500)
    await runtime.shutdownPackageStore()
    await runtime.initializePackageStore({ rootDir: storage.DATA_DIR })
    const after = await snapshot()
    expect(after.rows).toEqual(before.rows)
    expect(after.state.heads.map(head => head.presentationId)).toEqual(['source', 'winner'])
    expect(after.state.owners.filter(owner => owner.ownerType === 'presentation').map(owner => owner.ownerId)).toEqual(['source', 'winner'])
    const store = await runtime.getReadablePackageStore()
    for (const id of ['source', 'winner']) {
      const head = after.state.heads.find(item => item.presentationId === id)
      expect(await store.readOriginal(head.originalRevisionId)).toEqual(Buffer.from(`${id}-original`))
    }
  })

  it.each(['template', 'duplicate'])('%s does not quarantine a successor when JSON publication fails', async kind => {
    allocation = 'new-destination'
    const fsExtra = require('fs-extra')
    const original = fsExtra.writeJson.bind(fsExtra)
    let successor
    vi.spyOn(fsExtra, 'writeJson').mockImplementation(async (file, ...args) => {
      if (String(file).includes('presentations.json')) {
        await runtime.withPackageStore(async store => {
          await store.mutate(next => {
            const head = next.heads.find(item => item.presentationId === allocation)
            head.generation += 1
          })
          successor = store.getState()
        })
        throw Object.assign(new Error('JSON publication failed after successor'), { code: 'EIO' })
      }
      return original(file, ...args)
    })
    const response = await create(kind)
    expect(response.status).toBe(503)
    expect((await runtime.getReadablePackageStore()).getState()).toEqual(successor)
    expect((await storage.readPresentations()).map(row => row.id)).toEqual(['source', 'winner'])
  })
})
