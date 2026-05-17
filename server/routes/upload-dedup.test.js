import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import path from 'path'
import fs from 'fs-extra'
import uploadRouter from './upload.js'
import * as storage from '../services/storage.js'

function createApp() {
  const app = express()
  app.use('/api/upload', uploadRouter)
  return app
}

describe('Upload deduplication route', () => {
  const app = createApp()
  const createdFilenames = new Set()

  beforeAll(() => {
    storage.initDataFiles()
    fs.ensureDirSync(storage.UPLOADS_DIR)
  })

  afterEach(async () => {
    for (const filename of createdFilenames) {
      await fs.remove(path.join(storage.UPLOADS_DIR, filename))
    }
    createdFilenames.clear()
    await fs.remove(path.join(storage.DATA_DIR, 'upload-hashes.json'))
  })

  it('deduplicates repeated uploads by content hash within a presentation', async () => {
    const content = Buffer.from('test image data')

    const first = await request(app)
      .post('/api/upload')
      .field('presentationId', 'pres-1')
      .attach('file', content, 'first.svg')
    expect(first.status).toBe(200)
    expect(first.body.deduped).toBe(false)
    createdFilenames.add(path.basename(first.body.url))

    const second = await request(app)
      .post('/api/upload')
      .field('presentationId', 'pres-1')
      .attach('file', content, 'second.svg')
    expect(second.status).toBe(200)
    expect(second.body).toEqual({ url: first.body.url, deduped: true })
    expect(await fs.pathExists(path.join(storage.UPLOADS_DIR, path.basename(first.body.url)))).toBe(true)
  })

  it('does not deduplicate the same file across different presentations', async () => {
    const content = Buffer.from('shared image data')

    const first = await request(app)
      .post('/api/upload')
      .field('presentationId', 'pres-a')
      .attach('file', content, 'shared-a.svg')
    expect(first.status).toBe(200)
    expect(first.body.deduped).toBe(false)
    createdFilenames.add(path.basename(first.body.url))

    const second = await request(app)
      .post('/api/upload')
      .field('presentationId', 'pres-b')
      .attach('file', content, 'shared-b.svg')
    expect(second.status).toBe(200)
    expect(second.body.deduped).toBe(false)
    createdFilenames.add(path.basename(second.body.url))

    expect(second.body.url).not.toBe(first.body.url)
  })
})
