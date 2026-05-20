import express from 'express'
import fs from 'fs-extra'
import path from 'path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { DATA_DIR } from '../services/storage.js'
import pluginsRouter from './plugins.js'

const app = express()
app.use('/api/plugins', pluginsRouter)

describe('Plugins API', () => {
  it('lists bundled plugins in deterministic normalized shape', async () => {
    const res = await request(app).get('/api/plugins')

    expect(res.status).toBe(200)
    expect(res.body.some((plugin) => plugin.slug === 'animated-counter')).toBe(true)
    const plugin = res.body.find((item) => item.slug === 'animated-counter')
    expect(plugin).toMatchObject({
      id: 'navslides.animated-counter',
      name: 'Animated Counter',
      version: '1.0.0',
    })
    expect(plugin.contributes.elements[0]).toMatchObject({
      type: 'counter',
      label: 'Animated Counter',
      sandbox: 'sandbox.html',
    })
  })

  it('returns one plugin and its manifest', async () => {
    const pluginRes = await request(app).get('/api/plugins/animated-counter')
    const manifestRes = await request(app).get('/api/plugins/animated-counter/manifest')

    expect(pluginRes.status).toBe(200)
    expect(manifestRes.status).toBe(200)
    expect(manifestRes.body.slug).toBe('animated-counter')
  })

  it('rejects unknown and unsafe slugs', async () => {
    expect((await request(app).get('/api/plugins/missing-plugin')).status).toBe(404)
    expect((await request(app).get('/api/plugins/..%2Fsecret')).status).toBe(400)
  })

  it('serves dist assets and blocks asset traversal', async () => {
    const assetRes = await request(app).get('/api/plugins/animated-counter/assets/sandbox.html')
    const traversalRes = await request(app).get(
      '/api/plugins/animated-counter/assets/..%2Fparallax-plugin.json'
    )

    expect(assetRes.status).toBe(200)
    expect(assetRes.headers['content-type']).toContain('text/html')
    expect(assetRes.text).toContain('navslides')
    expect([400, 404]).toContain(traversalRes.status)
  })

  it('filters manifest contributions that cannot persist or export safely', async () => {
    const pluginDir = path.join(DATA_DIR, 'plugins', 'invalid-contract')
    await fs.ensureDir(pluginDir)
    await fs.writeJson(path.join(pluginDir, 'parallax-plugin.json'), {
      id: 'invalid.contract',
      name: 'Invalid Contract',
      version: '1.0.0',
      contributes: {
        elements: [
          { type: 'Bad Type', label: 'Bad Type', sandbox: 'sandbox.html' },
          { type: 'safe-type', label: 'Bad Sandbox', sandbox: '../secret.html' },
          { type: 'safe-counter', label: 'Safe Counter', sandbox: 'nested/sandbox.html' },
        ],
      },
    })

    try {
      const res = await request(app).get('/api/plugins/invalid-contract')

      expect(res.status).toBe(200)
      expect(res.body.contributes.elements).toEqual([
        { type: 'safe-counter', label: 'Safe Counter', defaultSize: { width: 360, height: 180 }, defaultData: {}, sandbox: 'nested/sandbox.html' },
      ])
    } finally {
      await fs.remove(pluginDir)
    }
  })
})
