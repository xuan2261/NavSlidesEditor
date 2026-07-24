import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

const UNKNOWN_JOB_ID = '00000000-0000-4000-8000-000000000000'
const originalNodeEnv = process.env.NODE_ENV

async function loadProductionApp() {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  const imported = await import('./index.js')
  return imported.app || imported.default?.app
}

afterEach(() => {
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
