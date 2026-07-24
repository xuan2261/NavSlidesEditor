import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import request from 'supertest'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import routeModule from './pptx-import.js'
import jobManager from '../services/pptx-import-job-manager.js'
import originalPackage from '../services/pptx-import/original-package.js'

const { createPptxImportRouter, runImport } = routeModule
const { persistOriginalPptx, getOriginalsDir, sha256Buffer } = originalPackage

async function writeMinimalPptx(filePath) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
}

async function waitForJob(app, jobId, status = 'done') {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const res = await request(app).get(`/api/pptx/jobs/${jobId}`)
    if (res.body.status === status) return res
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
  return request(app).get(`/api/pptx/jobs/${jobId}`)
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

      const poll = await waitForJob(app, res.body.jobId)
      expect(poll.status).toBe(200)
      expect(poll.body).toMatchObject({
        jobId: res.body.jobId,
        status: 'done',
        result: { stats: { parser: 'pptxtojson' }, presentationId: 'pres-test-1' },
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('publishes package authority via outbox-only writer, awaits drain, then completes the API job', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-package-authority-'))
    const file = path.join(dir, 'valid.pptx')
    let commitInput
    const createPresentation = vi.fn(async () => {
      throw new Error('createPresentation must not run on package path')
    })
    const drainOrder = []
    const drainCompatibility = vi.fn(async () => {
      drainOrder.push('drain')
      return 1
    })
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        importer: async () => ({
          presentation: { title: 'authoritative', theme: 'white', slides: [] },
          stats: { parser: 'pptxtojson', slideCount: 2 },
          warnings: [{ type: 'media-missing', message: 'img' }],
        }),
        createPresentation,
        deletePresentation: async () => true,
        drainCompatibility,
        packageCommit: async (source, input) => {
          drainOrder.push('commit')
          commitInput = { source, input }
          expect(input.compatibilityPresentation).toMatchObject({
            id: input.presentationId,
            title: 'authoritative',
            theme: 'white',
            transition: 'slide',
            _pptxImportReport: {
              schemaVersion: 1,
              jobId: input.jobId,
              summary: { warningCount: 1, byType: { 'media-missing': 1 }, omittedCount: 0 },
            },
          })
          expect(input.compatibilityPresentation.createdAt).toBe(input.compatibilityUpdatedAt)
          expect(input.projection._pptxImportReport).toEqual(
            input.compatibilityPresentation._pptxImportReport
          )
          return {
            revision: { id: 'r0-authoritative' },
            head: {
              originalRevisionId: 'r0-authoritative',
              packageRevisionId: 'r0-authoritative',
              generation: 1,
            },
          }
        },
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId)

      expect(poll.body).toMatchObject({
        status: 'done',
        result: {
          presentationId: commitInput.input.presentationId,
          reportSummary: {
            schemaVersion: 1,
            warningCount: 1,
            byType: { 'media-missing': 1 },
            omittedCount: 0,
          },
        },
      })
      expect(poll.body.result.warnings).toBeUndefined()
      expect(createPresentation).not.toHaveBeenCalled()
      expect(drainCompatibility).toHaveBeenCalledTimes(1)
      expect(drainOrder).toEqual(['commit', 'drain'])
      expect(commitInput.source).toBeTruthy()
      expect(commitInput.input).toMatchObject({
        jobId: res.body.jobId,
        presentationId: expect.any(String),
        projection: { id: commitInput.input.presentationId, title: 'authoritative' },
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('fails closed and rolls back when drain fails after package publish', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-route-drain-fail-'))
    const file = path.join(dir, 'valid.pptx')
    const packageRollback = vi.fn(async () => {})
    const createPresentation = vi.fn()
    try {
      await writeMinimalPptx(file)
      const app = express()
      app.use('/api/pptx', createPptxImportRouter({
        importer: async () => ({
          presentation: { title: 'drain-fail', slides: [] },
          stats: { parser: 'pptxtojson', slideCount: 0 },
          warnings: [],
        }),
        createPresentation,
        packageCommit: async (_source, input) => ({
          revision: { id: 'r0-x' },
          head: { generation: 1, packageRevisionId: 'r0-x', originalRevisionId: 'r0-x' },
          presentationId: input.presentationId,
        }),
        packageRollback,
        drainCompatibility: async () => {
          throw new Error('drain failed')
        },
      }))

      const res = await request(app).post('/api/pptx/import').attach('file', file)
      const poll = await waitForJob(app, res.body.jobId, 'failed')

      expect(poll.body).toMatchObject({ status: 'failed', error: 'drain failed' })
      expect(createPresentation).not.toHaveBeenCalled()
      expect(packageRollback).toHaveBeenCalledWith({
        jobId: res.body.jobId,
        presentationId: expect.any(String),
      })
    } finally {
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
      const poll = await waitForJob(app, res.body.jobId, 'failed')

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
      const poll = await waitForJob(app, res.body.jobId)
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
      expect(await request(app).delete(`/api/pptx/jobs/${first.body.jobId}`)).toMatchObject({ status: 204 })
      finishImport()
      const cancelled = await waitForJob(app, first.body.jobId, 'cancelled')
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
      const poll = await waitForJob(app, res.body.jobId, 'failed')
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
      const poll = await waitForJob(app, res.body.jobId, 'failed')
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
      const poll = await waitForJob(app, res.body.jobId, 'failed')
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
      const poll = await waitForJob(app, res.body.jobId, 'failed')
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
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }), ...mockAtomicDeps() }))

    const poll = await request(app).get(`/api/pptx/jobs/${jobId}`)
    expect(poll.status).toBe(200)
    expect(poll.body.status).toBe('running')

    const cancel = await request(app).delete(`/api/pptx/jobs/${jobId}`)
    expect(cancel.status).toBe(204)

    const cancelAgain = await request(app).delete(`/api/pptx/jobs/${jobId}`)
    expect(cancelAgain.status).toBe(409)

    const missing = await request(app).get('/api/pptx/jobs/00000000-0000-4000-8000-000000000000')
    expect(missing.status).toBe(404)
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
      expect(await request(app).delete(`/api/pptx/jobs/${first.body.jobId}`)).toMatchObject({ status: 204 })

      const secondWhileCancelling = await request(app).post('/api/pptx/import')
      expect(secondWhileCancelling.status).toBe(429)

      finishImport()
      const cancelled = await waitForJob(app, first.body.jobId, 'cancelled')
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
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }), ...mockAtomicDeps() }))
    const server = app.listen(0)
    const port = server.address().port

    try {
      const chunk = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/pptx/jobs/${jobId}/stream`, (res) => {
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
    try {
      vi.resetModules()
      process.env.NODE_ENV = 'production'
      const imported = await import('../index.js')
      const app = imported.app || imported.default?.app
      let last
      for (let i = 0; i < 31; i += 1) {
        last = await request(app).post('/api/pptx/import')
      }
      expect(last.status).toBe(429)
    } finally {
      vi.resetModules()
      process.env.NODE_ENV = originalNodeEnv
    }
  }, 30_000)
})

describe('runImport atomic helpers', () => {
  it('exports runImport for unit wiring', () => {
    expect(typeof runImport).toBe('function')
  })
})
