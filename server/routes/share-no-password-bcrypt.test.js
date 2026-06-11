// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

// A POST /share/:token carrying a `pwd` against a token that has NO stored
// password must not call bcrypt.compare(pwd, undefined) (which throws → 500).
// It should bounce back to the GET handler (redirect), which renders directly.

let app
let storage
let tmpDir
let originalDataDir
let originalUploadsDir

async function seedDeck() {
  const res = await request(app)
    .post('/api/presentations')
    .send({
      title: 'No-Password Deck',
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

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'share-no-pwd-bcrypt-'))
  originalDataDir = process.env.SLIDES_DATA_DIR
  originalUploadsDir = process.env.SLIDES_UPLOADS_DIR
  process.env.SLIDES_DATA_DIR = tmpDir
  process.env.SLIDES_UPLOADS_DIR = path.join(tmpDir, 'uploads')

  storage = await import('../services/storage.js')
  storage.initDataFiles()

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

describe('POST /share/:token with pwd against a no-password token', () => {
  it('does not 500; bounces back to the share view instead of calling bcrypt on undefined', async () => {
    const deckId = await seedDeck()
    const shareRes = await request(app)
      .post(`/api/presentations/${deckId}/share`)
      .send({ name: 'Open Link' }) // no password → tokenData.password is undefined
    expect(shareRes.status).toBe(200)
    const token = shareRes.body.token
    expect(token).toBeTruthy()

    const res = await request(app).post(`/share/${token}`).send({ pwd: 'anything' })
    expect(res.status).not.toBe(500)
    // Graceful redirect back to the GET handler (which renders directly).
    expect([301, 302, 303, 307, 308]).toContain(res.status)
  })
})
