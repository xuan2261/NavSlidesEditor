// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs-extra'

const _dataDir = vi.hoisted(() => {
  const os = require('os')
  const path = require('path')
  const fs = require('fs')
  const dir = path.join(os.tmpdir(), `navslides-history-test-${process.pid}-${Date.now()}`)
  fs.mkdirSync(dir, { recursive: true })
  process.env.SLIDES_DATA_DIR = dir
  return dir
})

const storage = await import('../services/storage.js')
const historyRouter = (await import('./history.js')).default

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/presentations', historyRouter)
  return app
}

function deferred() {
  let resolve
  const promise = new Promise((promiseResolve) => { resolve = promiseResolve })
  return { promise, resolve }
}

describe('POST /:id/restore/:snapshotId reversibility', () => {
  const presId = 'deck-1'

  beforeEach(async () => {
    storage.initDataFiles()
    await storage.writePresentations([
      { id: presId, title: 'Original', slides: [{ id: 's1', n: 1 }] },
    ])
  })

  it('auto-creates a before-restore snapshot and restores the chosen snapshot atomically', async () => {
    const app = makeApp()

    // Capture a snapshot of the original deck.
    const snapRes = await request(app)
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'v1' })
    expect(snapRes.status).toBe(200)
    const snapshotId = snapRes.body.id

    // Mutate the live deck so the restore target differs from current state.
    await storage.writePresentations([
      { id: presId, title: 'Mutated', slides: [{ id: 's1', n: 1 }, { id: 's2', n: 2 }] },
    ])

    // Restore the original snapshot.
    const restoreRes = await request(app)
      .post(`/api/presentations/${presId}/restore/${snapshotId}`)
    expect(restoreRes.status).toBe(200)
    expect(restoreRes.body.title).toBe('Original')
    expect(restoreRes.body.slides.length).toBe(1)

    // Deck now equals the restored snapshot.
    const stored = await storage.readPresentations()
    const deck = stored.find((p) => p.id === presId)
    expect(deck.title).toBe('Original')
    expect(deck.slides.length).toBe(1)

    // A NEW before-restore snapshot of the pre-restore (Mutated) state must exist.
    const listRes = await request(app).get(`/api/presentations/${presId}/snapshots`)
    expect(listRes.status).toBe(200)
    const beforeRestore = listRes.body.find((s) => /before restore/i.test(s.name || ''))
    expect(beforeRestore).toBeTruthy()
    expect(beforeRestore.slideCount).toBe(2)
  })

  it('rejects a legacy restore when a concurrent save changes the source', async () => {
    const app = makeApp()
    const snapRes = await request(app)
      .post(`/api/presentations/${presId}/snapshot`)
      .send({ name: 'v1' })
    expect(snapRes.status).toBe(200)
    const snapshotId = snapRes.body.id
    await storage.writePresentations([
      { id: presId, title: 'Mutated', slides: [{ id: 's1', n: 2 }] },
    ])

    const snapshotWriteStarted = deferred()
    const allowSnapshotWrite = deferred()
    const writeJson = fs.writeJson.bind(fs)
    let paused = false
    vi.spyOn(fs, 'writeJson').mockImplementation(async (file, ...args) => {
      if (!paused && String(file).includes('history')) {
        paused = true
        snapshotWriteStarted.resolve()
        await allowSnapshotWrite.promise
      }
      return writeJson(file, ...args)
    })

    try {
      const restore = request(app)
        .post(`/api/presentations/${presId}/restore/${snapshotId}`)
        .then((response) => response)
      await snapshotWriteStarted.promise
      await storage.writePresentations([
        { id: presId, title: 'Concurrent save', slides: [{ id: 's1', n: 3 }] },
      ])
      allowSnapshotWrite.resolve()

      const response = await restore
      expect(response.status).toBe(409)
      expect((await storage.readPresentations())[0].title).toBe('Concurrent save')
    } finally {
      allowSnapshotWrite.resolve()
      vi.restoreAllMocks()
    }
  })

  it('caps stored snapshots to the newest 50', async () => {
    const app = makeApp()
    for (let i = 0; i < 55; i++) {
      const r = await request(app)
        .post(`/api/presentations/${presId}/snapshot`)
        .send({ name: `snap-${i}` })
      expect(r.status).toBe(200)
    }
    const listRes = await request(app).get(`/api/presentations/${presId}/snapshots`)
    expect(listRes.body.length).toBeLessThanOrEqual(50)
  })
})
