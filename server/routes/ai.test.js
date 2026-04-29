import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import * as storage from '../services/storage.js'

import aiRouter from './ai.js'

describe('AI API', () => {
  const app = express()
  app.use(express.json())
  app.use('/api/ai', aiRouter)

  it('returns controlled error for malformed outline responses', async () => {
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

  it('does not leak provider internals on provider failures', async () => {
    storage.initDataFiles()
    await storage.writeSettings({
      ai: { provider: 'openai', apiKey: 'bad-key', model: 'gpt-4o-mini' },
    })
    global.fetch = async () => ({
      ok: false,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key internals' } }),
    })

    const res = await request(app).post('/api/ai/rewrite').send({ text: 'hello', action: 'improve' })
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('AI provider request failed')
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
