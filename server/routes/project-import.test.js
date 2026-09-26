import express from 'express'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import JSZip from 'jszip'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)

let root
let app

function resetCjsModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) {
      delete require.cache[key]
    }
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-route-import-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  vi.resetModules()
  resetCjsModules()
  require('../services/storage').initDataFiles()
  app = express()
  app.use(express.json())
  app.use('/api/project-imports', require('./project-import'))
})

afterEach(async () => {
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  vi.resetModules()
  resetCjsModules()
  await fs.remove(root)
})

async function deck() {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({ version: '1.1', media: [] }))
  zip.file('presentation.json', JSON.stringify({
    title: 'Deck',
    slides: [{ id: 's1', elements: [] }],
  }))
  return zip.generateAsync({ type: 'nodebuffer' })
}

function editor(requestBuilder) {
  return requestBuilder
    .set('Host', 'localhost')
    .set('Origin', 'http://localhost')
    .set('Referer', 'http://localhost/')
    .set('Sec-Fetch-Site', 'same-origin')
}

describe('project import routes', () => {
  it('rejects cross-origin preflight before creating a session', async () => {
    const response = await request(app)
      .post('/api/project-imports/preflight')
      .set('Host', 'localhost')
      .set('Origin', 'https://attacker.test')
      .attach('file', await deck(), 'deck.navslides')
    expect(response.status).toBe(403)
    expect(response.body.code).toBe('PROJECT_IMPORT_ORIGIN_REJECTED')
  })

  it('requires the separate capability for media, publish, and rollback', async () => {
    const admitted = await editor(request(app).post('/api/project-imports/preflight'))
      .attach('file', await deck(), 'deck.navslides')
    expect(admitted.status).toBe(201)
    expect(admitted.body.capability).toBeTruthy()

    const denied = await editor(request(app)
      .post(`/api/project-imports/${admitted.body.sessionId}/media`))
    expect(denied.status).toBe(403)

    const published = await editor(request(app)
      .post(`/api/project-imports/${admitted.body.sessionId}/publish`))
      .set('X-NavSlides-Import-Capability', admitted.body.capability)
      .send({ trustedAuthorActiveContentAcknowledged: false })
    expect(published.status).toBe(201)
    expect(published.body).toMatchObject({ status: 'committed' })
  })
})
