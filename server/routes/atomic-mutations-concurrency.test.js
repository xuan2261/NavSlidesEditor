// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

// Share-token mutations must be atomic (read-modify-write under a lock). The
// non-atomic readShareTokens()+writeShareTokens() pattern loses updates when
// many create/revoke ops interleave: each handler reads the same baseline and
// the last writer wins, dropping the others.

let app
let storage
let shareRouter
let tmpDir
let originalDataDir

const DECK_ID = 'concurrency-deck'

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'share-concurrency-'))
  originalDataDir = process.env.SLIDES_DATA_DIR
  process.env.SLIDES_DATA_DIR = tmpDir

  storage = await import('../services/storage.js')
  storage.initDataFiles()
  await storage.writePresentations([{ id: DECK_ID, title: 'Deck', slides: [] }])

  shareRouter = (await import('./share.js')).default
  app = express()
  app.use(express.json())
  app.use('/api/presentations', shareRouter)
})

afterAll(async () => {
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  await fs.remove(tmpDir).catch(() => {})
})

beforeEach(async () => {
  await storage.writeShareTokens({})
})

describe('Atomic share-token mutations (I-R5.1)', () => {
  it('does not lose tokens when many creates run concurrently', async () => {
    const N = 25
    const ops = Array.from({ length: N }, (_, i) =>
      request(app).post(`/api/presentations/${DECK_ID}/share`).send({ name: `Link ${i}` })
    )
    const results = await Promise.all(ops)
    for (const r of results) expect(r.status).toBe(200)

    const tokens = await storage.readShareTokens()
    const forDeck = Object.values(tokens).filter(
      (t) => (typeof t === 'string' ? t : t?.presentationId) === DECK_ID
    )
    // Every concurrent create must survive — no lost updates.
    expect(forDeck.length).toBe(N)
  })

  it('keeps state consistent under interleaved create and revoke', async () => {
    // Pre-seed tokens that will be revoked concurrently with new creates.
    const seed = {}
    const seededTokens = []
    for (let i = 0; i < 15; i++) {
      const t = `seed-${i}`
      seed[t] = { presentationId: DECK_ID, name: `Seed ${i}`, views: 0 }
      seededTokens.push(t)
    }
    await storage.writeShareTokens(seed)

    const createOps = Array.from({ length: 15 }, (_, i) =>
      request(app).post(`/api/presentations/${DECK_ID}/share`).send({ name: `New ${i}` })
    )
    // DELETE /:id/share removes ALL tokens for the deck. Mixing it concurrently
    // with creates is the harshest interleave; assert the final state is a clean
    // subset (no partial/garbage entries, no non-deck tokens lost).
    const revokeOps = Array.from({ length: 5 }, () =>
      request(app).delete(`/api/presentations/${DECK_ID}/share`)
    )

    const results = await Promise.all([...createOps, ...revokeOps])
    for (const r of results) expect(r.status).toBe(200)

    const tokens = await storage.readShareTokens()
    // Every surviving entry must be a well-formed object (no corruption from
    // interleaved RMW), and all must belong to the deck.
    for (const [token, data] of Object.entries(tokens)) {
      expect(typeof token).toBe('string')
      expect(data).toBeTruthy()
      const pid = typeof data === 'string' ? data : data.presentationId
      expect(pid).toBe(DECK_ID)
    }
  })
})
