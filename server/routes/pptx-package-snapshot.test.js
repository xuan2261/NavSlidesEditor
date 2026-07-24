import crypto from 'node:crypto'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import * as storage from '../services/storage.js'
import presentationsRouter from './presentations.js'
import packageStoreModule from '../services/pptx-import/package-store/index.js'

const { openPackageStore } = packageStoreModule

function createApp() {
  const app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api/presentations', presentationsRouter)
  return app
}

async function commitPackage(bytes, presentationId) {
  const store = await openPackageStore({ rootDir: path.resolve(storage.DATA_DIR) })
  await store.acquireWriter()
  try {
    return await store.commitOriginal(bytes, {
      ownerType: 'presentation',
      ownerId: presentationId,
    })
  } finally {
    await store.releaseWriter()
  }
}

describe('PPTX package authority snapshot route', () => {
  const app = createApp()

  beforeAll(() => {
    storage.initDataFiles()
  })

  it('returns a safe identity bound to the package head and immutable original', async () => {
    const bytes = Buffer.from(`snapshot-${crypto.randomUUID()}`)
    const created = await request(app)
      .post('/api/presentations')
      .send({ title: 'Snapshot', slides: [{ id: 's1', elements: [] }] })
    expect(created.status).toBe(201)
    const id = created.body.id
    await commitPackage(bytes, id)
    const store = await openPackageStore({ rootDir: path.resolve(storage.DATA_DIR) })
    const head = store.getState().heads.find((item) => item.presentationId === id)
    await storage.withPresentations((presentations) => {
      presentations.find((item) => item.id === id).pptxAggregateHead = head
    })

    const response = await request(app).get(`/api/presentations/${id}/pptx-package-snapshot`)
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      schemaVersion: 1,
      presentationId: id,
      packageAuthority: {
        revisionId: head.packageRevisionId,
        headHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      aggregateGeneration: head.generation,
      original: {
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        byteLength: bytes.length,
      },
    })
    expect(response.body).not.toHaveProperty('originalBytes')

    const original = await request(app)
      .get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', String(head.generation))
      .set('If-Pptx-Package-Revision', head.packageRevisionId)
      .set('If-Pptx-Package-Head-Hash', response.body.packageAuthority.headHash)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })
    expect(original.status).toBe(200)
    expect(original.body.equals(bytes)).toBe(true)

    const stale = await request(app)
      .get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', String(head.generation))
      .set('If-Pptx-Package-Revision', head.packageRevisionId)
      .set('If-Pptx-Package-Head-Hash', 'f'.repeat(64))
    expect(stale).toMatchObject({
      status: 409,
      body: { code: 'STALE_PACKAGE_AUTHORITY' },
    })

    const mixedRevision = await request(app)
      .get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', String(head.generation))
      .set('If-Pptx-Package-Revision', `r0-${'f'.repeat(64)}`)
      .set('If-Pptx-Package-Head-Hash', response.body.packageAuthority.headHash)
    expect(mixedRevision).toMatchObject({
      status: 409,
      body: { code: 'STALE_PACKAGE_AUTHORITY' },
    })
    await request(app).delete(`/api/presentations/${id}/permanent`)
  })

  it('returns not found for a missing presentation', async () => {
    const response = await request(app)
      .get(`/api/presentations/${crypto.randomUUID()}/pptx-package-snapshot`)
    expect(response.status).toBe(404)
  })
})
