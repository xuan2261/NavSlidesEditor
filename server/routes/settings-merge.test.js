// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'

// Point storage at an isolated temp dir BEFORE the storage module loads.
const _dataDir = vi.hoisted(() => {
  const os = require('os')
  const path = require('path')
  const fs = require('fs')
  const dir = path.join(os.tmpdir(), `navslides-settings-test-${process.pid}-${Date.now()}`)
  fs.mkdirSync(dir, { recursive: true })
  process.env.SLIDES_DATA_DIR = dir
  return dir
})

const storage = await import('../services/storage.js')
const settingsRouter = (await import('./settings.js')).default

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/settings', settingsRouter)
  return app
}

describe('PUT /api/settings deep-merge ai', () => {
  beforeEach(async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-secret-original' },
      defaultTheme: 'black',
    })
  })

  it('preserves stored ai.apiKey when client omits it', async () => {
    const app = makeApp()
    const res = await request(app)
      .put('/api/settings')
      .send({ ai: { model: 'gpt-4o-mini' } })

    expect(res.status).toBe(200)
    // Response masks the key but must still be configured.
    expect(res.body.ai.apiKey).toBe('***configured***')

    const stored = await storage.readSettings()
    expect(stored.ai.apiKey).toBe('sk-secret-original')
    expect(stored.ai.model).toBe('gpt-4o-mini')
    // unspecified ai sub-keys preserved
    expect(stored.ai.provider).toBe('openai')
  })

  it('replaces a non-ai top-level key as before (PUT contract)', async () => {
    const app = makeApp()
    const res = await request(app)
      .put('/api/settings')
      .send({ defaultTheme: 'white' })

    expect(res.status).toBe(200)
    const stored = await storage.readSettings()
    expect(stored.defaultTheme).toBe('white')
    // ai untouched, key intact
    expect(stored.ai.apiKey).toBe('sk-secret-original')
  })

  it('honors the ***configured*** sentinel echo', async () => {
    const app = makeApp()
    await request(app)
      .put('/api/settings')
      .send({ ai: { provider: 'openai', model: 'm', apiKey: '***configured***' } })

    const stored = await storage.readSettings()
    expect(stored.ai.apiKey).toBe('sk-secret-original')
  })
})
