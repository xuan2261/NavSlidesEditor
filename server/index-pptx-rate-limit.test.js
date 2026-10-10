import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const UNKNOWN_JOB_ID = '00000000-0000-4000-8000-000000000000'
const originalNodeEnv = process.env.NODE_ENV
const originalDataDir = process.env.SLIDES_DATA_DIR
const originalUploadsDir = process.env.SLIDES_UPLOADS_DIR
let rootDir
let server
let stopServer

async function loadProductionApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-production-quota-'))
  process.env.SLIDES_DATA_DIR = rootDir
  process.env.SLIDES_UPLOADS_DIR = path.join(rootDir, 'uploads')
  const imported = await import('./index.js')
  stopServer = imported.stopServer
  server = await imported.startServer(0, { host: '127.0.0.1' })
  return imported.app || imported.default?.app
}

afterEach(async () => {
  if (server) await stopServer(server)
  if (rootDir) await fs.rm(rootDir, { recursive: true, force: true })
  if (originalDataDir === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalDataDir
  if (originalUploadsDir === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = originalUploadsDir
  vi.resetModules()
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
})

describe('production PPTX import rate limits', () => {
  it('reserves upload quota for POST import instead of job reads and cancellation', async () => {
    const app = await loadProductionApp()

    for (const [method, path] of [
      ['get', `/api/pptx/jobs/${UNKNOWN_JOB_ID}`],
      ['get', `/api/pptx/jobs/${UNKNOWN_JOB_ID}/stream`],
      ['delete', `/api/pptx/jobs/${UNKNOWN_JOB_ID}`],
    ]) {
      for (let attempt = 0; attempt < 31; attempt += 1) {
        const response = await request(app)[method](path)
        expect(response.status).toBe(404)
      }
    }

    let response
    for (let attempt = 0; attempt < 31; attempt += 1) {
      response = await request(app).post('/api/pptx/import')
      expect(response.status).toBe(attempt < 30 ? 400 : 429)
    }
  })
})
