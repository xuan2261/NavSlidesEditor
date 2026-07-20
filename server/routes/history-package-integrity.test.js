// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs-extra'
import path from 'node:path'
import crypto from 'node:crypto'

const _dataDir = vi.hoisted(() => {
  const os = require('os')
  const path = require('path')
  const dir = path.join(os.tmpdir(), `navslides-history-package-test-${process.pid}-${Date.now()}`)
  require('fs').mkdirSync(dir, { recursive: true })
  process.env.SLIDES_DATA_DIR = dir
  return dir
})

const storage = await import('../services/storage.js')
const { openPackageStore } = await import('../services/pptx-import/package-store/index.js')
const historyRouter = (await import('./history.js')).default

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/presentations', historyRouter)
  return app
}

async function withStore(action) {
  const store = await openPackageStore({ rootDir: storage.DATA_DIR })
  await store.acquireWriter()
  try {
    return await action(store)
  } finally {
    await store.releaseWriter()
  }
}

describe('package-backed history integrity', () => {
  const presId = 'deck-1'

  beforeEach(async () => {
    vi.restoreAllMocks()
    storage.initDataFiles()
    await storage.writePresentations([
      { id: presId, title: 'Current', slides: [{ id: 's1' }] },
    ])
    const head = await withStore((store) => store.commitOriginal(Buffer.from('package'), {
      ownerType: 'presentation',
      ownerId: presId,
    }))
    await storage.withPresentations((presentations) => {
      presentations[0].pptxAggregateHead = head
    })
  })

  afterEach(async () => {
    await fs.remove(_dataDir)
    await fs.ensureDir(_dataDir)
  })

  it('rejects encoded path traversal without touching presentation storage', async () => {
    const before = await fs.readFile(path.join(storage.DATA_DIR, 'presentations.json'), 'utf8')

    const deleteResponse = await request(makeApp())
      .delete(`/api/presentations/${presId}/snapshots/%2e%2e%2f%2e%2e%2fpresentations`)

    expect(deleteResponse.status).toBe(400)
    expect(await fs.readFile(path.join(storage.DATA_DIR, 'presentations.json'), 'utf8')).toBe(before)
  })

  it('rejects a legacy snapshot restore into a package-backed presentation', async () => {
    const snapshotId = crypto.randomUUID()
    const dir = path.join(storage.HISTORY_DIR, presId)
    await fs.ensureDir(dir)
    await fs.writeJson(path.join(dir, `${snapshotId}.json`), {
      id: snapshotId,
      name: 'legacy',
      createdAt: new Date().toISOString(),
      packageBacked: false,
      data: { id: presId, title: 'Legacy', slides: [{ id: 's1' }] },
    })

    const response = await request(makeApp())
      .post(`/api/presentations/${presId}/restore/${snapshotId}`)

    expect(response.status).not.toBe(200)
    expect((await storage.readPresentations())[0]).toMatchObject({
      title: 'Current',
      pptxAggregateHead: expect.anything(),
    })
  })

  it('rejects a restore when its retained package aggregate is missing', async () => {
    const app = makeApp()
    const snapshot = await request(app)
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'package-backed' })
    expect(snapshot.status).toBe(200)

    await withStore((store) => store.releaseOwner({
      ownerType: 'history',
      ownerId: `${presId}:${snapshot.body.id}`,
    }))
    const response = await request(app)
      .post(`/api/presentations/${presId}/restore/${snapshot.body.id}`)

    expect(response.status).not.toBe(200)
    expect((await storage.readPresentations())[0].title).toBe('Current')
    expect((await fs.readdir(path.join(storage.HISTORY_DIR, presId)))
      .filter((file) => file.endsWith('.json'))).toHaveLength(1)
  })

  it('persists the restored aggregate head and successor generation', async () => {
    const app = makeApp()
    const snapshot = await request(app)
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'package-backed' })
    expect(snapshot.status).toBe(200)

    await storage.writePresentations([
      { id: presId, title: 'Changed', slides: [{ id: 's1' }] },
    ])
    const restored = await request(app)
      .post(`/api/presentations/${presId}/restore/${snapshot.body.id}`)

    expect(restored.status).toBe(200)
    expect(restored.body.aggregateGeneration).toBe(2)
    const stored = (await storage.readPresentations()).find((item) => item.id === presId)
    expect(stored.pptxAggregateHead).toMatchObject({ generation: 2 })
    await withStore((store) => {
      expect(store.getState().heads.find((head) => head.presentationId === presId)).toMatchObject({
        generation: 2,
        packageRevisionId: stored.pptxAggregateHead.packageRevisionId,
      })
    })
  })

  it('does not create a legacy snapshot when the package head is unavailable', async () => {
    await withStore((store) => store.quarantinePresentation(presId))

    const response = await request(makeApp())
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'must-not-downgrade' })

    expect(response.status).not.toBe(200)
    const historyDir = path.join(storage.HISTORY_DIR, presId)
    const historyFiles = await fs.pathExists(historyDir) ? await fs.readdir(historyDir) : []
    expect(historyFiles.filter((file) => file.endsWith('.json'))).toEqual([])
  })

  it('releases retained package ownership when snapshot persistence fails', async () => {
    const app = makeApp()
    const writeJson = fs.writeJson.bind(fs)
    vi.spyOn(fs, 'writeJson').mockImplementation(async (file, ...args) => {
      if (String(file).includes(`${path.sep}history${path.sep}`)) {
        throw new Error('injected snapshot write failure')
      }
      return writeJson(file, ...args)
    })

    const response = await request(app)
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'must-not-publish' })

    expect(response.status).not.toBe(200)
    await withStore((store) => {
      expect(store.getState().owners.filter((owner) => owner.ownerType === 'history')).toEqual([])
    })
  })
})
