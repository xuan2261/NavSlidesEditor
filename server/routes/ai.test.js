import { afterEach, describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import * as storage from '../services/storage.js'

import aiRouter from './ai.js'

describe('AI API', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/ai', aiRouter)
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('[cap:ai.failure tier:deep] returns controlled error for malformed outline responses', async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
    })
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not-json' } }] }),
    })

    const res = await request(app).post('/api/ai/generate-outline').send({ topic: 'Security test' })
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('AI returned invalid outline')
  })

  it('[cap:ai.failure tier:deep] does not leak provider internals on provider failures', async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'bad-key', model: 'gpt-4o-mini' },
    })
    global.fetch = async () => ({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key internals' } }),
    })

    const res = await request(app)
      .post('/api/ai/rewrite')
      .send({ text: 'hello', action: 'improve' })
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('AI provider request failed')
  })

  it('[cap:ai.failure tier:deep] redacts token-like provider exception details from responses and logs', async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'sk-test-secret-token', model: 'gpt-4o-mini' },
    })
    global.fetch = async () => {
      throw new Error('network failure for sk-test-secret-token')
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await request(app)
      .post('/api/ai/rewrite')
      .send({ text: 'hello', action: 'improve' })
    const logOutput = consoleSpy.mock.calls.flat().map(String).join(' ')

    expect(res.status).toBe(502)
    expect(JSON.stringify(res.body)).not.toContain('sk-test-secret-token')
    expect(logOutput).not.toContain('sk-test-secret-token')
    expect(logOutput).toContain('<REDACTED_TOKEN>')
  })

  it('[cap:ai.failure tier:deep] returns controlled error when translate provider returns malformed JSON', async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' },
    })
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '<not-json>' } }] }),
    })

    const res = await request(app)
      .post('/api/ai/translate')
      .send({ texts: [{ key: '0', html: '<p>Hello</p>' }], targetLanguage: 'vi' })
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('AI provider request failed')
  })

  it('[cap:ai.failure] rejects AI actions without configuration before provider calls', async () => {
    storage.initDataFiles()
    await storage.writeSettings({ ai: { provider: 'openai', apiKey: '' } })
    let called = false
    global.fetch = async () => {
      called = true
      return { ok: true, json: async () => ({}) }
    }

    const rewrite = await request(app).post('/api/ai/rewrite').send({
      text: 'hello',
      action: 'improve',
    })
    const outline = await request(app).post('/api/ai/generate-outline').send({
      topic: 'No key',
    })
    const translate = await request(app)
      .post('/api/ai/translate')
      .send({
        texts: [{ key: '0', html: '<p>Hello</p>' }],
        targetLanguage: 'vi',
      })

    expect(rewrite.status).toBe(400)
    expect(outline.status).toBe(400)
    expect(translate.status).toBe(400)
    expect(rewrite.body.error).toBe('AI not configured')
    expect(outline.body.error).toBe('AI not configured')
    expect(translate.body.error).toBe('AI not configured')
    expect(called).toBe(false)
  })

  it('tests a transient AI configuration without persisting or returning its credentials', async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'stored-key', model: 'gpt-4o-mini' },
    })
    let authorization
    global.fetch = async (_url, options) => {
      authorization = options.headers.Authorization
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'OK' } }] }),
      }
    }

    const res = await request(app).post('/api/ai/test-connection').send({
      provider: 'openai',
      apiKey: 'transient-key',
      model: 'gpt-4o',
      customEndpoint: '',
      customModel: '',
    })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(JSON.stringify(res.body)).not.toContain('transient-key')
    expect(authorization).toBe('Bearer transient-key')
    expect((await storage.readSettings()).ai.apiKey).toBe('stored-key')
  })

  it('escapes generated slide HTML content and notes', async () => {
    const res = await request(app)
      .post('/api/ai/generate-slides')
      .send({
        outline: [
          {
            title: '<script>alert("title")</script>',
            bulletPoints: ['Safe', '<img src=x onerror=alert("bullet")>'],
            layout: 'content" onmouseover="alert(1)',
            speakerNotes: '<b>note</b><script>alert("note")</script>',
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.slides).toHaveLength(1)

    const [html] = res.body.slides
    expect(html).toContain('&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(&quot;bullet&quot;)&gt;')
    expect(html).toContain('data-layout="content&quot; onmouseover=&quot;alert(1)"')
    expect(html).toContain(
      '<aside class="notes">&lt;b&gt;note&lt;/b&gt;&lt;script&gt;alert(&quot;note&quot;)&lt;/script&gt;</aside>'
    )
    expect(html).not.toContain('<script>alert("title")</script>')
  })
})
