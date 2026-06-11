// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

// Soft-deleted (trashed) decks must NOT be served or forked anywhere. A single
// serve-guard (findServeablePresentation) is the chokepoint; restore must make
// the same share link work again without any token reactivation.

let app
let storage
let tmpDir
let originalDataDir
let originalUploadsDir

async function seedDeck() {
  const res = await request(app)
    .post('/api/presentations')
    .send({
      title: 'Guard Deck',
      theme: 'black',
      slides: [
        {
          id: 'slide-1',
          notes: '',
          elements: [{ id: 'el-1', type: 'text', x: 10, y: 10, width: 200, height: 80, content: '<p>Hi</p>' }],
        },
      ],
    })
  expect(res.status).toBe(201)
  return res.body.id
}

async function mintShare(deckId) {
  const res = await request(app).post(`/api/presentations/${deckId}/share`).send({ name: 'Link' })
  return res
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'soft-delete-guard-'))
  originalDataDir = process.env.SLIDES_DATA_DIR
  originalUploadsDir = process.env.SLIDES_UPLOADS_DIR
  process.env.SLIDES_DATA_DIR = tmpDir
  process.env.SLIDES_UPLOADS_DIR = path.join(tmpDir, 'uploads')

  storage = await import('../services/storage.js')
  storage.initDataFiles()
  // Configure GitHub so the push handler reaches the deck lookup (not the config gate).
  await storage.writeGithubConfig({ token: 'fake-token', owner: 'owner', repo: 'repo' })

  const mod = await import('../index.js')
  app = mod.app
})

afterAll(async () => {
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  if (originalUploadsDir === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = originalUploadsDir
  await fs.remove(tmpDir).catch(() => {})
})

describe('Soft-delete serve-guard (C2)', () => {
  it('serves and forks an active deck, then refuses every sink once trashed, then serves again after restore', async () => {
    const deckId = await seedDeck()
    const shareRes = await mintShare(deckId)
    expect(shareRes.status).toBe(200)
    const token = shareRes.body.token
    expect(token).toBeTruthy()

    // ── Active deck: all sinks WORK ──────────────────────────────────────────
    expect((await request(app).get(`/share/${token}`)).status).toBe(200)
    expect((await request(app).get(`/api/presentations/${deckId}`)).status).toBe(200)
    expect((await request(app).get(`/api/presentations/${deckId}/present`)).status).toBe(200)
    expect((await request(app).get(`/api/presentations/${deckId}/export`)).status).toBe(200)
    expect((await request(app).get(`/api/presentations/${deckId}/uploads`)).status).toBe(200)

    const dupRes = await request(app).post(`/api/presentations/${deckId}/duplicate`)
    expect(dupRes.status).toBe(201)

    const tmplRes = await request(app).post(`/api/presentations/${deckId}/save-as-template`).send({})
    expect(tmplRes.status).toBe(201)

    const forkRes = await request(app).post(`/api/explore/${token}/fork`)
    expect(forkRes.status).toBe(200)

    // ── Soft delete ──────────────────────────────────────────────────────────
    const delRes = await request(app).delete(`/api/presentations/${deckId}`)
    expect(delRes.status).toBe(200)

    // ── Trashed deck: every sink REFUSES (404) ───────────────────────────────
    expect((await request(app).get(`/share/${token}`)).status).toBe(404)
    expect((await request(app).get(`/api/presentations/${deckId}`)).status).toBe(404)
    expect((await request(app).get(`/api/presentations/${deckId}/present`)).status).toBe(404)
    expect((await request(app).get(`/api/presentations/${deckId}/export`)).status).toBe(404)
    expect((await request(app).get(`/api/presentations/${deckId}/uploads`)).status).toBe(404)
    expect((await request(app).post(`/api/presentations/${deckId}/duplicate`)).status).toBe(404)
    expect(
      (await request(app).post(`/api/presentations/${deckId}/save-as-template`).send({})).status
    ).toBe(404)
    expect((await request(app).post(`/api/explore/${token}/fork`)).status).toBe(404)

    const pushRes = await request(app).post(`/api/presentations/${deckId}/github/push`).send({})
    expect(pushRes.status).toBe(404)

    // Mint-new-share-token on a trashed deck must be refused.
    const reMint = await mintShare(deckId)
    expect(reMint.status).toBe(404)

    // ── Restore: same share link serves again, no token reactivation step ─────
    const restoreRes = await request(app).post(`/api/presentations/${deckId}/restore`)
    expect(restoreRes.status).toBe(200)

    expect((await request(app).get(`/share/${token}`)).status).toBe(200)
    expect((await request(app).get(`/api/presentations/${deckId}`)).status).toBe(200)
  })
})
