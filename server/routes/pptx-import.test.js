import fs from 'node:fs/promises'
import http from 'node:http'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import routeModule from './pptx-import.js'
import jobManager from '../services/pptx-import-job-manager.js'
import originalPackage from '../services/pptx-import/original-package.js'
import storage from '../services/storage.js'
// Match the route's CJS loader so initialization reaches its runtime singleton.
const nodeRequire = createRequire(import.meta.url)
const packageRuntime = nodeRequire('../services/pptx-import/package-store-runtime.js')

const { createPptxImportRouter, drainDetachedImportCleanups } = routeModule
const { persistOriginalPptx, getOriginalsDir, sha256Buffer } = originalPackage

async function writeMinimalPptx(filePath) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
}

function withCapability(req, capability) {
  return capability ? req.set('X-Pptx-Job-Capability', capability) : req
}

async function waitForJob(app, jobId, status = 'done', capability = null) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const res = await withCapability(request(app).get(`/api/pptx/jobs/${jobId}`), capability)
    if (res.body.status === status) return res
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  return withCapability(request(app).get(`/api/pptx/jobs/${jobId}`), capability)
}

function mockAtomicDeps(overrides = {}) {
  return {
    persistOriginal: async () => ({
      id: '11111111-1111-4111-8111-111111111111',
      sha256: 'a'.repeat(64),
      byteLength: 12,
      uploadedAt: new Date().toISOString(),
    }),
    createPresentation: async () => ({ id: 'pres-test-1' }),
    deleteOriginal: async () => true,
    packageCommit: null,
    packageRollback: null,
    ...overrides,
  }
}

describe('PPTX import route', () => {
  afterEach(() => {
    jobManager._reset()
  })

  it('[cap:import.upload-safety] rejects missing file and non-PPTX uploads', async () => {
    const app = express()
    app.use('/api/pptx', createPptxImportRouter({ importer: async () => ({ ok: true }), ...mockAtomicDeps() }))

    const missing = await request(app).post('/api/pptx/import')
    expect(missing.status).toBe(400)

    const pdf = await request(app)
      .post('/api/pptx/import')
      .attach('file', Buffer.from('%PDF'), 'deck.pdf')
    expect(pdf.status).toBe(400)
  })

  it('returns 202 and exposes completed import output through job polling', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-'))
    const file = path.join(dir, 'valid.pptx')
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          ...mockAtomicDeps(),
          importer: async () => ({
            presentation: { title: 'valid', theme: 'white', transition: 'slide', slides: [] },
            stats: { parser: 'pptxtojson', slideCount: 0 },
            warnings: [],
          }),
        })
      )

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      expect(res.status).toBe(202)
      expect(res.body.jobId).toMatch(/^[0-9a-f-]{36}$/i)

      const poll = await waitForJob(app, res.body.jobId, 'done', res.body.capability)
      expect(poll.status).toBe(200)
      expect(poll.body).toMatchObject({
        jobId: res.body.jobId,
        status: 'done',
        result: { stats: { parser: 'pptxtojson' }, presentationId: 'pres-test-1' },
      })

      const tooLate = await withCapability(
        request(app).delete(`/api/pptx/jobs/${res.body.jobId}`),
        res.body.capability
      )
      expect(tooLate.status).toBe(409)
      expect(tooLate.body).toMatchObject({
        error: 'job-too-late',
        code: 'JOB_CANCEL_TOO_LATE',
        status: 'done',
        job: { result: { presentationId: 'pres-test-1' } },
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('returns a typed in-progress response for repeated cancellation', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-cancel-'))
    const file = path.join(dir, 'valid.pptx')
    let releaseDrain, markDrainStarted, releaseRollback, markRollbackStarted
    const drainGate = new Promise((resolve) => { releaseDrain = resolve })
    const drainStarted = new Promise((resolve) => { markDrainStarted = resolve })
    const rollbackGate = new Promise((resolve) => { releaseRollback = resolve })
    const rollbackStarted = new Promise((resolve) => { markRollbackStarted = resolve })
    try {
      await writeMinimalPptx(file)
      storage.initDataFiles()
      await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        importer: async () => ({
          presentation: { title: 'cancel', slides: [] }, sourceMap: { entries: {} },
          stats: { parser: 'pptxtojson', slideCount: 0 }, warnings: [],
        }),
        drainCompatibility: async () => { markDrainStarted(); await drainGate },
        packageRollback: async (input) => {
          markRollbackStarted()
          await rollbackGate
          return packageRuntime.withPackageStore((store) => store.rollbackImport(input))
        },
      }))
      const admitted = await request(app).post('/api/pptx/import').attach('file', file)
      expect(admitted.status).toBe(202)
      await drainStarted
      const cancel = () => withCapability(
        request(app).delete(`/api/pptx/jobs/${admitted.body.jobId}`), admitted.body.capability
      )
      expect((await cancel()).status).toBe(204)
      releaseDrain()
      await rollbackStarted
      const inProgress = await cancel()
      expect(inProgress.status).toBe(409)
      expect(inProgress.body).toMatchObject({
        error: 'job-cancellation-in-progress', code: 'JOB_CANCEL_IN_PROGRESS', status: 'cancelling',
      })
      releaseRollback()
      await drainDetachedImportCleanups()
      const finished = await cancel()
      expect(finished.status).toBe(409)
      expect(finished.body).toMatchObject({
        error: 'job-already-finished', code: 'JOB_ALREADY_FINISHED', status: 'cancelled',
      })
    } finally {
      releaseDrain?.()
      releaseRollback?.()
      await drainDetachedImportCleanups()
      await packageRuntime.shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('publishes an HTTP-imported package projection before returning an openable job', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-package-authority-'))
    const file = path.join(dir, 'valid.pptx')
    try {
      await writeMinimalPptx(file)
      const original = await fs.readFile(file)
      storage.initDataFiles()
      await storage.writePresentations([])
      await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        importer: async () => ({
          presentation: { title: 'authoritative', theme: 'white', slides: [] },
          sourceMap: { entries: {} },
          stats: { parser: 'pptxtojson', slideCount: 0 },
          warnings: [{ type: 'media-missing', message: 'img' }],
        }),
      }))
      const admitted = await request(app).post('/api/pptx/import').attach('file', file)
      expect(admitted.status).toBe(202)
      const poll = await waitForJob(app, admitted.body.jobId, 'done', admitted.body.capability)
      expect(poll.body, JSON.stringify({
        error: poll.body.error,
        code: poll.body.code,
        stage: poll.body.stage,
        failureStage: poll.body.failureStage,
        message: poll.body.message,
      })).toMatchObject({
        status: 'done',
        result: { reportSummary: { warningCount: 1, byType: { 'media-missing': 1 } } },
      })
      const row = (await storage.readPresentations()).find((item) =>
        item.id === poll.body.result.presentationId
      )
      expect(row).toMatchObject({
        title: 'authoritative',
        _pptxImportReport: { jobId: admitted.body.jobId },
      })
      const store = packageRuntime.getPackageStore()
      expect(row.pptxAggregateHead).toEqual(
        store.getState().heads.find((head) => head.presentationId === row.id)
      )
      expect(await store.readOriginal(row.pptxAggregateHead.originalRevisionId)).toEqual(original)
      expect(store.getState().compatibilityOutbox).toEqual([])
    } finally {
      await drainDetachedImportCleanups()
      await packageRuntime.shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails closed and records an exact rollback when drain fails after package publish', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-drain-fail-'))
    const file = path.join(dir, 'valid.pptx')
    let publishedHead
    let publishedJob
    try {
      await writeMinimalPptx(file)
      const original = await fs.readFile(file)
      storage.initDataFiles()
      await storage.writePresentations([])
      await packageRuntime.initializePackageStore({ rootDir: storage.DATA_DIR })
      const store = packageRuntime.getPackageStore()
      const priorHeads = new Set(store.getState().heads.map(head => head.presentationId))
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        importer: async () => ({
          presentation: { title: 'drain-fail', slides: [] },
          sourceMap: { entries: {} },
          stats: { parser: 'pptxtojson', slideCount: 0 },
          warnings: [],
        }),
        drainCompatibility: async () => {
          const state = store.getState()
          publishedHead = state.heads.find(head => !priorHeads.has(head.presentationId))
          publishedJob = state.jobs.find(job => job.presentationId === publishedHead.presentationId)
          throw new Error('drain failed')
        },
      }))
      const admitted = await request(app).post('/api/pptx/import').attach('file', file)
      expect(admitted.status).toBe(202)
      const poll = await waitForJob(app, admitted.body.jobId, 'failed', admitted.body.capability)
      expect(poll.body.status).toBe('failed')
      expect((await storage.readPresentations()).some(row => row.id === publishedHead.presentationId)).toBe(false)
      expect(store.getState().heads.some(head => head.presentationId === publishedHead.presentationId)).toBe(false)
      expect(await store.getJob(admitted.body.jobId)).toMatchObject({
        id: admitted.body.jobId, status: 'failed', transactionState: 'rolled-back', cancellationPoint: 'rolled-back',
        outcomeRevisionId: publishedJob.outcomeRevisionId,
        outcomeGeneration: publishedJob.outcomeGeneration,
        outcomeHeadHash: publishedJob.outcomeHeadHash,
      })
      expect(await store.readOriginal(publishedHead.originalRevisionId)).toEqual(original)
    } finally {
      await drainDetachedImportCleanups()
      await packageRuntime.shutdownPackageStore()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails closed before making a compatibility presentation visible when package publication fails', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-package-failure-'))
    const file = path.join(dir, 'valid.pptx')
    const deletePresentation = vi.fn(async () => true)
    const createPresentation = vi.fn()
    const drainCompatibility = vi.fn()
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        importer: async () => ({
          presentation: { title: 'blocked', slides: [] },
          stats: { parser: 'pptxtojson', slideCount: 0 },
          warnings: [],
        }),
        createPresentation,
        deletePresentation,
        drainCompatibility,
        packageCommit: async () => {
          throw new Error('package transaction failed')
        },
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed', res.body.capability)

      expect(poll.body).toMatchObject({ status: 'failed', error: 'package transaction failed' })
      expect(createPresentation).not.toHaveBeenCalled()
      expect(drainCompatibility).not.toHaveBeenCalled()
      expect(deletePresentation).not.toHaveBeenCalled()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('T1.4 successful job includes presentationId + stats; original sha256 bound on create', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-t14-'))
    const file = path.join(dir, 'valid.pptx')
    const originalsBase = path.join(dir, 'data')
    /** @type {object|null} */
    let createdPayload = null
    try {
      await writeMinimalPptx(file)
      const fileBuf = await fs.readFile(file)
      const expectedSha = sha256Buffer(fileBuf)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          originalBaseDir: originalsBase,
          // Legacy path: createPresentation is the sole writer, no package store.
          packageCommit: null,
          packageRollback: null,
          persistOriginal: (fp, opts) => persistOriginalPptx(fp, opts),
          createPresentation: async (presentation, artifact, options = {}) => {
            createdPayload = { presentation, artifact, options }
            return {
              id: 'pres-bound-1',
              pptxOriginal: artifact,
              _pptxImportReport: options.importReport,
            }
          },
          deleteOriginal: async () => true,
          importer: async () => ({
            presentation: { title: 'bound', theme: 'white', slides: [] },
            stats: { parser: 'pptxtojson', slideCount: 0 },
            warnings: [{ type: 'test', message: 'warn' }],
          }),
        })
      )

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'done', res.body.capability)
      expect(poll.body.status).toBe('done')
      expect(poll.body.result.presentationId).toBe('pres-bound-1')
      expect(poll.body.result.presentation).toBeUndefined()
      expect(poll.body.result.stats.parser).toBe('pptxtojson')
      // Bounded reportSummary replaces unbounded warnings on job result.
      expect(poll.body.result.warnings).toBeUndefined()
      expect(poll.body.result.reportSummary).toMatchObject({
        schemaVersion: 1,
        warningCount: 1,
        byType: { test: 1 },
        omittedCount: 0,
      })
      expect(createdPayload.options.importReport).toMatchObject({
        schemaVersion: 1,
        summary: { warningCount: 1, byType: { test: 1 } },
        diagnostics: [{ type: 'test', message: 'warn' }],
      })
      expect(createdPayload.artifact.sha256).toBe(expectedSha)
      expect(createdPayload.artifact.id).toMatch(/^[0-9a-f-]{36}$/i)
      const stored = await fs.readFile(
        path.join(getOriginalsDir(originalsBase), `${createdPayload.artifact.id}.pptx`)
      )
      expect(stored.equals(fileBuf)).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('T1.7 cancelled import leaves no original in pptx-originals', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-t17-'))
    const file = path.join(dir, 'valid.pptx')
    const originalsBase = path.join(dir, 'data')
    let finishImport
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          jobManager,
          originalBaseDir: originalsBase,
          persistOriginal: (fp, opts) => persistOriginalPptx(fp, opts),
          createPresentation: async () => ({ id: 'should-not-create' }),
          deleteOriginal: (id, opts) => originalPackage.deleteOriginalPptx(id, opts),
          importer: (_filePath, options) =>
            new Promise((resolve) => {
              options.signal.addEventListener('abort', () => {})
              finishImport = () =>
                resolve({ presentation: { slides: [] }, stats: {}, warnings: [] })
            }),
        })
      )

      const first = await request(app).post('/api/pptx/import').attach('file', file)
      expect(first.status).toBe(202)
      expect(await withCapability(request(app).delete(`/api/pptx/jobs/${first.body.jobId}`), first.body.capability)).toMatchObject({ status: 204 })
      finishImport()
      const cancelled = await waitForJob(app, first.body.jobId, 'cancelled', first.body.capability)
      expect(cancelled.body.status).toBe('cancelled')

      const originalsDir = getOriginalsDir(originalsBase)
      const names = await fs.readdir(originalsDir).catch(() => [])
      expect(names.filter((n) => n.endsWith('.pptx'))).toHaveLength(0)
    } finally {
      finishImport?.()
      await new Promise((resolve) => setTimeout(resolve, 20))
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('T1.10 createPresentation failure rolls back original file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-t110-'))
    const file = path.join(dir, 'valid.pptx')
    const originalsBase = path.join(dir, 'data')
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          originalBaseDir: originalsBase,
          persistOriginal: (fp, opts) => persistOriginalPptx(fp, opts),
          createPresentation: async () => {
            throw new Error('storage full')
          },
          deleteOriginal: (id, opts) => originalPackage.deleteOriginalPptx(id, opts),
          importer: async () => ({
            presentation: { title: 'fail-create', slides: [] },
            stats: { parser: 'pptxtojson' },
            warnings: [],
          }),
        })
      )

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed', res.body.capability)
      expect(poll.body.status).toBe('failed')
      const names = await fs.readdir(getOriginalsDir(originalsBase)).catch(() => [])
      expect(names.filter((n) => n.endsWith('.pptx'))).toHaveLength(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('returns 429 with Retry-After while another import is running', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-limit-'))
    const file = path.join(dir, 'valid.pptx')
    let finishImport
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          jobManager,
          ...mockAtomicDeps(),
          importer: () =>
            new Promise((resolve) => {
              finishImport = () => resolve({ presentation: { slides: [] }, stats: {}, warnings: [] })
            }),
        })
      )

      const first = await request(app).post('/api/pptx/import').attach('file', file)
      const second = await request(app).post('/api/pptx/import')
      expect(first.status).toBe(202)
      expect(second.status).toBe(429)
      expect(second.headers['retry-after']).toBe('60')
      expect(second.body.error).toBe('import-in-progress')
    } finally {
      finishImport?.()
      await new Promise((resolve) => setTimeout(resolve, 10))
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails an import at the overall deadline even when the importer ignores abort', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-deadline-'))
    const file = path.join(dir, 'valid.pptx')
    let finishImport
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        jobManager,
        ...mockAtomicDeps(),
        importTimeoutMs: 10,
        importer: () => new Promise((resolve) => {
          finishImport = () => resolve({ presentation: { slides: [] }, stats: {}, warnings: [] })
        }),
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed', res.body.capability)
      expect(poll.body).toMatchObject({
        status: 'failed',
        error: 'PPTX import deadline exceeded',
      })
      expect((await request(app).post('/api/pptx/import')).status).toBe(429)

      finishImport()
      await vi.waitFor(() => expect(jobManager.getJob(res.body.jobId)?.operationPending).toBe(false))
      expect((await request(app).post('/api/pptx/import')).status).toBe(400)
    } finally {
      finishImport?.()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails a hanging original persistence stage and deletes a late artifact', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-persist-deadline-'))
    const file = path.join(dir, 'valid.pptx')
    let finishPersist
    let finishDelete
    const deleteOriginal = vi.fn(() => new Promise((resolve) => {
      finishDelete = () => resolve(true)
    }))
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        ...mockAtomicDeps({ deleteOriginal }),
        importTimeoutMs: 10,
        importer: async () => ({ presentation: { slides: [] }, stats: {}, warnings: [] }),
        persistOriginal: () => new Promise((resolve) => {
          finishPersist = () => resolve({ id: 'late-original', sha256: 'b'.repeat(64) })
        }),
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed', res.body.capability)
      expect(poll.body.error).toBe('PPTX import deadline exceeded')

      finishPersist()
      await vi.waitFor(() => expect(deleteOriginal).toHaveBeenCalledWith('late-original', {}))
      expect((await request(app).post('/api/pptx/import')).status).toBe(429)
      finishDelete()
      await vi.waitFor(async () => {
        expect((await request(app).post('/api/pptx/import')).status).toBe(400)
      })
    } finally {
      finishPersist?.()
      finishDelete?.()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('tracks a late rejected persistence stage without overwriting the terminal job', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-late-reject-'))
    const file = path.join(dir, 'valid.pptx')
    let rejectPersist
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failJob = vi.spyOn(jobManager, 'failJob')
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        jobManager,
        ...mockAtomicDeps(),
        importTimeoutMs: 10,
        importer: async () => ({ presentation: { slides: [] }, stats: {}, warnings: [] }),
        persistOriginal: () => new Promise((_resolve, reject) => {
          rejectPersist = reject
        }),
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed', res.body.capability)
      expect(poll.body.error).toBe('PPTX import deadline exceeded')
      expect(failJob).toHaveBeenCalledTimes(1)

      rejectPersist(new Error('late persistence failure'))
      await drainDetachedImportCleanups({ timeoutMs: 1000 })
      expect(failJob).toHaveBeenCalledTimes(1)
      expect((await request(app).post('/api/pptx/import')).status).toBe(400)
      expect(warn).toHaveBeenCalledWith(
        '[pptx-import] detached stage rejected:',
        'late persistence failure'
      )
    } finally {
      rejectPersist?.(new Error('test cleanup'))
      warn.mockRestore()
      failJob.mockRestore()
      await drainDetachedImportCleanups({ timeoutMs: 1000 })
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails a hanging presentation create stage and deletes a late presentation', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-create-deadline-'))
    const file = path.join(dir, 'valid.pptx')
    let finishCreate
    let finishOriginalDelete
    const deletePresentation = vi.fn(async () => true)
    const deleteOriginal = vi.fn(() => new Promise((resolve) => {
      finishOriginalDelete = () => resolve(true)
    }))
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        ...mockAtomicDeps({ deleteOriginal }),
        deletePresentation,
        importTimeoutMs: 10,
        importer: async () => ({ presentation: { slides: [] }, stats: {}, warnings: [] }),
        createPresentation: () => new Promise((resolve) => {
          finishCreate = () => resolve({ id: 'late-presentation' })
        }),
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed', res.body.capability)
      expect(poll.body.error).toBe('PPTX import deadline exceeded')
      expect(deleteOriginal).toHaveBeenCalled()

      finishCreate()
      await vi.waitFor(() => expect(deletePresentation).toHaveBeenCalledWith('late-presentation'))
      finishOriginalDelete()
    } finally {
      finishCreate?.()
      finishOriginalDelete?.()
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects a concurrent import before requiring multipart upload parsing', async () => {
    const app = express()
    const activeJobId = jobManager.createJob()
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }), ...mockAtomicDeps() }))

    const res = await request(app).post('/api/pptx/import')

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBe('60')
    expect(jobManager.getJob(activeJobId)).toMatchObject({ status: 'running' })
  })

  it('returns job lifecycle statuses for GET and DELETE', async () => {
    const app = express()
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }), ...mockAtomicDeps() }))

    const poll = await withCapability(request(app).get(`/api/pptx/jobs/${jobId}`), capability)
    expect(poll.status).toBe(200)
    expect(poll.body.status).toBe('running')

    const cancel = await withCapability(request(app).delete(`/api/pptx/jobs/${jobId}`), capability)
    expect(cancel.status).toBe(204)

    const cancelAgain = await withCapability(request(app).delete(`/api/pptx/jobs/${jobId}`), capability)
    expect(cancelAgain.status).toBe(409)

    const missing = await request(app).get('/api/pptx/jobs/00000000-0000-4000-8000-000000000000')
    expect(missing.status).toBe(404)

    jobManager.completeCancellation(jobId)
    jobManager.cleanup(jobId)
    const deniedJobId = jobManager.createJob()
    const denied = await request(app).get(`/api/pptx/jobs/${deniedJobId}`)
    expect(denied.status).toBe(401)
    expect(denied.body.code).toBe('JOB_CAPABILITY_REQUIRED')
    const wrong = await withCapability(request(app).get(`/api/pptx/jobs/${deniedJobId}`), '0'.repeat(64))
    expect(wrong.status).toBe(401)
    // Query capability is SSE-only; GET must ignore it.
    const queryDenied = await request(app).get(
      `/api/pptx/jobs/${deniedJobId}?capability=${jobManager.takeJobCapability(deniedJobId)}`
    )
    expect(queryDenied.status).toBe(401)
    jobManager.cleanup(deniedJobId)
  })

  it('keeps a cancelled import slot reserved until the background import settles', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-cancel-limit-'))
    const file = path.join(dir, 'valid.pptx')
    let finishImport
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use(
        '/api/pptx',
        createPptxImportRouter({
          jobManager,
          ...mockAtomicDeps(),
          importer: (_filePath, options) =>
            new Promise((resolve) => {
              options.signal.addEventListener('abort', () => {})
              finishImport = () => resolve({ presentation: { slides: [] }, stats: {}, warnings: [] })
            }),
        })
      )

      const first = await request(app).post('/api/pptx/import').attach('file', file)
      expect(first.status).toBe(202)
      expect(await withCapability(request(app).delete(`/api/pptx/jobs/${first.body.jobId}`), first.body.capability)).toMatchObject({ status: 204 })

      const secondWhileCancelling = await request(app).post('/api/pptx/import')
      expect(secondWhileCancelling.status).toBe(429)

      finishImport()
      const cancelled = await waitForJob(app, first.body.jobId, 'cancelled', first.body.capability)
      expect(cancelled.body.status).toBe('cancelled')
      await vi.waitFor(() => expect(jobManager.getJob(first.body.jobId)?.operationPending).toBe(false))

      const secondAfterSettled = await request(app).post('/api/pptx/import')
      expect(secondAfterSettled.status).toBe(400)
    } finally {
      finishImport?.()
      await new Promise((resolve) => setTimeout(resolve, 10))
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('streams SSE progress and detaches clients on close', async () => {
    const app = express()
    const jobId = jobManager.createJob()
    const capability = jobManager.takeJobCapability(jobId)
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }), ...mockAtomicDeps() }))
    const server = app.listen(0)
    const port = server.address().port

    try {
      const chunk = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/pptx/jobs/${jobId}/stream?capability=${encodeURIComponent(capability)}`, (res) => {
          expect(res.headers['content-type']).toContain('text/event-stream')
          res.on('data', (data) => {
            req.destroy()
            resolve(data.toString())
          })
        })
        req.on('error', reject)
      })

      expect(chunk).toContain('event: progress')
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(jobManager.getJob(jobId).sseClients.size).toBe(0)
    } finally {
      await new Promise((resolve) => server.close(resolve))
    }
  })

  it('[cap:import.upload-safety] rejects invalid jobId params in the mounted app', async () => {
    vi.resetModules()
    const imported = await import('../index.js')
    const app = imported.app || imported.default?.app
    const res = await request(app).get('/api/pptx/jobs/not-a-uuid')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid jobId')
  }, 30_000)

  it('[cap:import.upload-safety] applies the upload limiter to PPTX import in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalDataDir = process.env.SLIDES_DATA_DIR
    const originalUploadsDir = process.env.SLIDES_UPLOADS_DIR
    const rootDir = storage.DATA_DIR
    let server
    let stopServer
    try {
      vi.resetModules()
      process.env.NODE_ENV = 'production'
      process.env.SLIDES_DATA_DIR = rootDir
      process.env.SLIDES_UPLOADS_DIR = storage.UPLOADS_DIR
      const imported = await import('../index.js')
      const app = imported.app || imported.default?.app
      stopServer = imported.stopServer
      server = await imported.startServer(0, { host: '127.0.0.1' })
      let last
      for (let i = 0; i < 31; i += 1) {
        last = await request(app).post('/api/pptx/import')
      }
      expect(last.status).toBe(429)
    } finally {
      if (server) await stopServer(server)
      if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
      else process.env.SLIDES_DATA_DIR = originalDataDir
      if (originalUploadsDir === undefined) delete process.env.SLIDES_UPLOADS_DIR
      else process.env.SLIDES_UPLOADS_DIR = originalUploadsDir
      vi.resetModules()
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = originalNodeEnv
    }
  }, 30_000)
})

