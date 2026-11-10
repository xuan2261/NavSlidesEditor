// @vitest-environment node
// Multipart routing contract, not native corpus or visual qualification.
import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import routeModule from './pptx-import.js'
import jobManager from '../services/pptx-import-job-manager.js'

const { createPptxImportRouter, drainDetachedImportCleanups } = routeModule

function harness(importer) {
  let settled
  const finished = new Promise((resolve) => {
    settled = resolve
  })
  const jobs = {
    ...jobManager,
    settleOperation(jobId) {
      jobManager.settleOperation(jobId)
      settled()
    },
  }
  const persistOriginal = vi.fn(async () => ({
    id: '11111111-1111-4111-8111-111111111111',
    sha256: 'a'.repeat(64),
    byteLength: 4,
    uploadedAt: '2026-10-16T00:00:00.000Z',
  }))
  const createPresentation = vi.fn(async (presentation) => ({
    ...presentation,
    id: 'semantic-route-deck',
  }))
  const app = express()
  app.use(
    '/api/pptx',
    createPptxImportRouter({
      importer,
      jobManager: jobs,
      persistOriginal,
      createPresentation,
      deletePresentation: vi.fn(),
      deleteOriginal: vi.fn(),
      packageCommit: null,
      packageRollback: null,
    })
  )
  return { app, finished, persistOriginal, createPresentation }
}

afterEach(async () => {
  await drainDetachedImportCleanups()
  jobManager._reset()
})

describe('production multipart semantic import admission', () => {
  it.each([false, true])(
    'enables source semantics and inheritance despite client disable fields=%s',
    async (disableFields) => {
      const semantic = {
        schemaVersion: 1,
        definitions: {},
        instances: {},
        styles: {},
        fonts: {},
      }
      const importer = vi.fn(async () => ({
        presentation: { title: 'Source model', slides: [], pptxSemantic: semantic },
        stats: { slideCount: 0 },
        warnings: [],
      }))
      const h = harness(importer)
      let upload = request(h.app).post('/api/pptx/import')
      if (disableFields) {
        upload = upload.field('semanticImport', 'false').field('geometryInheritance', 'false')
      }
      const admitted = await upload.attach('file', Buffer.from('PK\x03\x04'), 'deck.pptx')
      expect(admitted.status).toBe(202)
      await h.finished
      expect(importer).toHaveBeenCalledOnce()
      expect(importer.mock.calls[0][1]).toMatchObject({
        semanticImport: true,
        geometryInheritance: true,
        signal: expect.any(AbortSignal),
        mediaTransaction: expect.any(Object),
      })
      expect(h.createPresentation).toHaveBeenCalledOnce()
      expect(h.createPresentation.mock.calls[0][0].pptxSemantic).toEqual(semantic)
      const job = await request(h.app)
        .get(`/api/pptx/jobs/${admitted.body.jobId}`)
        .set('X-Pptx-Job-Capability', admitted.body.capability)
      expect(job.status).toBe(200)
      expect(job.body).toMatchObject({
        status: 'done',
        result: { presentationId: 'semantic-route-deck' },
      })
    }
  )

  it('keeps failed semantic admission terminal without a legacy retry or publication', async () => {
    const importer = vi.fn(async () => {
      throw Object.assign(new Error('Unmapped source extension at ppt/presProps.xml'), {
        code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
      })
    })
    const h = harness(importer)
    const admitted = await request(h.app)
      .post('/api/pptx/import')
      .attach('file', Buffer.from('PK\x03\x04'), 'unsupported.pptx')
    expect(admitted.status).toBe(202)
    await h.finished
    expect(importer).toHaveBeenCalledOnce()
    expect(importer.mock.calls[0][1]).toMatchObject({
      semanticImport: true,
      geometryInheritance: true,
    })
    expect(h.persistOriginal).not.toHaveBeenCalled()
    expect(h.createPresentation).not.toHaveBeenCalled()
    const job = await request(h.app)
      .get(`/api/pptx/jobs/${admitted.body.jobId}`)
      .set('X-Pptx-Job-Capability', admitted.body.capability)
    expect(job.status).toBe(200)
    expect(job.body).toMatchObject({
      status: 'failed',
      code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
    })
    expect(job.body).not.toHaveProperty('result')
  })
})
