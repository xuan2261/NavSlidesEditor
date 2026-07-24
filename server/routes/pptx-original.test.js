import crypto from 'node:crypto'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import * as storage from '../services/storage.js'
import presentationsRouter from './presentations.js'
import originalPackage from '../services/pptx-import/original-package.js'
import packageStoreModule from '../services/pptx-import/package-store/index.js'

const { persistOriginalPptx, sha256Buffer, readOriginalPptx } = originalPackage
const { openPackageStore } = packageStoreModule

async function commitPackageOriginal(bytes, presentationId) {
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

function createApp() {
  const app = express()
  app.use(express.json({ limit: '5mb' }))
  app.use('/api/presentations', presentationsRouter)
  return app
}

describe('PPTX original package routes (T1.5 T1.6 T1.9)', () => {
  const app = createApp()

  beforeAll(() => {
    storage.initDataFiles()
  })

  it('T1.5 GET download returns bytes equal to fixture; client path fields ignored on create', async () => {
    const buf = Buffer.from(`fixture-pptx-${crypto.randomUUID()}`)
    const artifact = await persistOriginalPptx(buf)
    const createRes = await request(app)
      .post('/api/presentations')
      .send({
        title: `Original DL ${Date.now()}`,
        slides: [{ id: 's1', elements: [], notes: '' }],
        // Client attempts to bind path — must be stripped
        pptxOriginal: {
          id: artifact.id,
          sha256: artifact.sha256,
          byteLength: artifact.byteLength,
          uploadedAt: artifact.uploadedAt,
          filename: '../../../etc/passwd',
          path: 'C:\\\\evil\\\\steal.pptx',
        },
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.pptxOriginal).toBeUndefined()

    // Server-side bind (simulates import create)
    await storage.withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === createRes.body.id)
      pres.pptxOriginal = {
        id: artifact.id,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        uploadedAt: artifact.uploadedAt,
      }
    })

    const dl = await request(app)
      .get(`/api/presentations/${createRes.body.id}/pptx-original`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })
    expect(dl.status).toBe(200)
    expect(dl.headers['x-pptx-original-sha256']).toBe(sha256Buffer(buf))
    expect(dl.headers['content-type']).toContain('presentationml')
    expect(Buffer.isBuffer(dl.body) && dl.body.equals(buf)).toBe(true)

    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })

  it('T1.6 permanent DELETE releases ownership but retains immutable recovery bytes', async () => {
    const buf = Buffer.from(`lifecycle-${crypto.randomUUID()}`)
    const artifact = await persistOriginalPptx(buf)
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: `Life ${Date.now()}`, slides: [{ id: 's1', elements: [] }] })
    const id = createRes.body.id
    const committed = await commitPackageOriginal(buf, id)
    await storage.withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === id)
      pres.pptxOriginal = {
        id: artifact.id,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        uploadedAt: artifact.uploadedAt,
      }
    })

    const soft = await request(app).delete(`/api/presentations/${id}`)
    expect(soft.status).toBe(200)
    // Soft-delete keeps original so restore remains zero-loss
    expect(await readOriginalPptx(artifact.id)).not.toBeNull()

    const permanent = await request(app).delete(`/api/presentations/${id}/permanent`)
    expect(permanent.status).toBe(200)

    // Deleted presentation routes cannot expose retained internal bytes.
    expect((await request(app).get(`/api/presentations/${id}`)).status).toBe(404)
    expect((await request(app).get(`/api/presentations/${id}/pptx-original`)).status).toBe(404)

    // Phase 3 is collector-only: release/quarantine metadata, never physical GC.
    expect(await readOriginalPptx(artifact.id)).toEqual(buf)
    const store = await openPackageStore({ rootDir: path.resolve(storage.DATA_DIR) })
    const state = store.getState()
    expect(state.heads.some((head) => head.presentationId === id)).toBe(false)
    expect(
      state.owners.some((owner) => owner.ownerType === 'presentation' && owner.ownerId === id)
    ).toBe(false)
    expect(await store.readBlob(committed.blob.sha256)).toEqual(buf)
    expect(store.auditCollection()).toEqual(
      expect.objectContaining({
        mode: 'audit-only',
        physicalDeletionEnabled: false,
        candidates: expect.arrayContaining([committed.blob.sha256]),
      })
    )
  })

  it('T1.9 wrong presentation id → 404; invalid id format rejected at app level when mounted', async () => {
    const missing = await request(app).get(
      `/api/presentations/${crypto.randomUUID()}/pptx-original`
    )
    expect(missing.status).toBe(404)

    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: `NoOrig ${Date.now()}`, slides: [{ id: 's1', elements: [] }] })
    const noOrig = await request(app).get(`/api/presentations/${createRes.body.id}/pptx-original`)
    expect(noOrig.status).toBe(404)
    await request(app).delete(`/api/presentations/${createRes.body.id}/permanent`)
  })

  it('H1 duplicate gets independent original copy; permanent delete of copy keeps source', async () => {
    const buf = Buffer.from(`dup-${crypto.randomUUID()}`)
    const artifact = await persistOriginalPptx(buf)
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: `DupSrc ${Date.now()}`, slides: [{ id: 's1', elements: [] }] })
    const id = createRes.body.id
    await storage.withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === id)
      pres.pptxOriginal = {
        id: artifact.id,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        uploadedAt: artifact.uploadedAt,
      }
    })

    const dup = await request(app).post(`/api/presentations/${id}/duplicate`)
    expect(dup.status).toBe(201)
    expect(dup.body.pptxOriginal?.id).toBeTruthy()
    expect(dup.body.pptxOriginal.id).not.toBe(artifact.id)
    expect(dup.body.pptxOriginal.sha256).toBe(artifact.sha256)

    await request(app).delete(`/api/presentations/${dup.body.id}/permanent`)
    expect(await readOriginalPptx(artifact.id)).not.toBeNull()
    expect(await readOriginalPptx(dup.body.pptxOriginal.id)).toEqual(buf)

    await request(app).delete(`/api/presentations/${id}/permanent`)
    expect(await readOriginalPptx(artifact.id)).toEqual(buf)
    expect(await readOriginalPptx(dup.body.pptxOriginal.id)).toEqual(buf)
  })

  it('H1 package-backed duplicate retains shared legacy and package recovery bytes', async () => {
    const buf = Buffer.from(`shared-dup-${crypto.randomUUID()}`)
    const artifact = await persistOriginalPptx(buf)
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: `SharedDup ${Date.now()}`, slides: [{ id: 's1', elements: [] }] })
    const id = createRes.body.id
    const committed = await commitPackageOriginal(buf, id)
    await storage.withPresentations((presentations) => {
      presentations.find((presentation) => presentation.id === id).pptxOriginal = {
        id: artifact.id,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        uploadedAt: artifact.uploadedAt,
      }
    })

    const dup = await request(app).post(`/api/presentations/${id}/duplicate`)
    expect(dup.status).toBe(201)
    expect(dup.body.pptxOriginal.id).toBe(artifact.id)

    expect((await request(app).delete(`/api/presentations/${dup.body.id}/permanent`)).status).toBe(
      200
    )
    expect((await request(app).delete(`/api/presentations/${id}/permanent`)).status).toBe(200)
    expect(await readOriginalPptx(artifact.id)).toEqual(buf)

    const store = await openPackageStore({ rootDir: path.resolve(storage.DATA_DIR) })
    expect(await store.readBlob(committed.blob.sha256)).toEqual(buf)
    expect(store.auditCollection()).toMatchObject({
      mode: 'audit-only',
      physicalDeletionEnabled: false,
    })
  })

  it('downloads exact immutable package-store original bytes for an unchanged package-backed import', async () => {
    const buf = Buffer.from(`package-only-${crypto.randomUUID()}`)
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: `PackageOnly ${Date.now()}`, slides: [{ id: 's1', elements: [] }] })
    const id = createRes.body.id
    await commitPackageOriginal(buf, id)
    const store = await openPackageStore({ rootDir: path.resolve(storage.DATA_DIR) })
    const head = store.getState().heads.find((item) => item.presentationId === id)
    await storage.withPresentations((presentations) => {
      presentations.find((presentation) => presentation.id === id).pptxAggregateHead = head
    })

    const invalidGeneration = await request(app)
      .get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', '0')
    expect(invalidGeneration).toMatchObject({
      status: 400,
      body: { code: 'INVALID_EXPECTED_GENERATION' },
    })

    const staleGeneration = await request(app)
      .get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', String(head.generation + 1))
    expect(staleGeneration).toMatchObject({
      status: 409,
      body: { code: 'STALE_GENERATION', currentGeneration: head.generation },
    })

    const download = await request(app)
      .get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', String(head.generation))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })

    expect(download.status).toBe(200)
    expect(download.headers['x-pptx-export-mode']).toBe('immutable-package-original')
    expect(download.headers['x-pptx-original-sha256']).toBe(sha256Buffer(buf))
    expect(Buffer.isBuffer(download.body) && download.body.equals(buf)).toBe(true)
    await request(app).delete(`/api/presentations/${id}/permanent`)
  })

  it('M1 PUT cannot rebind or inject pptxOriginal paths', async () => {
    const buf = Buffer.from(`put-${crypto.randomUUID()}`)
    const artifact = await persistOriginalPptx(buf)
    const createRes = await request(app)
      .post('/api/presentations')
      .send({ title: `PutBind ${Date.now()}`, slides: [{ id: 's1', elements: [] }] })
    const id = createRes.body.id
    await storage.withPresentations((presentations) => {
      const pres = presentations.find((p) => p.id === id)
      pres.pptxOriginal = {
        id: artifact.id,
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        uploadedAt: artifact.uploadedAt,
      }
    })

    const put = await request(app)
      .put(`/api/presentations/${id}`)
      .send({
        title: 'Updated',
        pptxOriginal: {
          id: '99999999-9999-4999-8999-999999999999',
          filename: '../../../evil.pptx',
          path: 'C:\\\\evil',
        },
      })
    expect(put.status).toBe(200)
    expect(put.body.title).toBe('Updated')
    expect(put.body.pptxOriginal?.id).toBe(artifact.id)
    expect(put.body.pptxOriginal?.filename).toBeUndefined()

    await request(app).delete(`/api/presentations/${id}/permanent`)
  })
})
