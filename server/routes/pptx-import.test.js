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

const { createPptxImportRouter } = routeModule

async function writeMinimalPptx(filePath) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types />')
  zip.file('ppt/presentation.xml', '<p:presentation />')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
}

async function waitForJob(app, jobId, status = 'done') {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await request(app).get(`/api/pptx/jobs/${jobId}`)
    if (res.body.status === status) return res
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return request(app).get(`/api/pptx/jobs/${jobId}`)
}

describe('PPTX import route', () => {
  afterEach(() => {
    jobManager._reset()
  })

  it('[cap:import.upload-safety] rejects missing file and non-PPTX uploads', async () => {
    const app = express()
    app.use('/api/pptx', createPptxImportRouter({ importer: async () => ({ ok: true }) }))

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
          importer: async () => ({
            presentation: { title: 'valid', theme: 'white', transition: 'slide', slides: [] },
            stats: { parser: 'pptxtojson', fallbackParserUsed: false, slideCount: 0 },
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
        result: { stats: { parser: 'pptxtojson' } },
      })
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
          importer: () => new Promise((resolve) => {
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

  it('rejects a concurrent import before requiring multipart upload parsing', async () => {
    const app = express()
    const activeJobId = jobManager.createJob()
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }) }))

    const res = await request(app).post('/api/pptx/import')

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBe('60')
    expect(jobManager.getJob(activeJobId)).toMatchObject({ status: 'running' })
  })

  it('returns job lifecycle statuses for GET and DELETE', async () => {
    const app = express()
    const jobId = jobManager.createJob()
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }) }))

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
          importer: (_filePath, options) => new Promise((resolve) => {
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
    app.use('/api/pptx', createPptxImportRouter({ jobManager, importer: async () => ({ ok: true }) }))
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
  })

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
  })
})
