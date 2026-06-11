// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'

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
