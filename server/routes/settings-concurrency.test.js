// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createRequire } from 'node:module'

const load = createRequire(import.meta.url)
const fs = load('fs-extra')
const path = load('node:path')
const os = load('node:os')
const previous = { data: process.env.SLIDES_DATA_DIR, uploads: process.env.SLIDES_UPLOADS_DIR }
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-revision-'))
process.env.SLIDES_DATA_DIR = path.join(root, 'data')
process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
const fixture = { root, previous }
const storage = load('../services/storage.js')
const app = express()
app.use(express.json())
app.use('/api/settings', load('./settings.js'))
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: 'settings failure' }))
const put = (body, revision = 0) => request(app).put('/api/settings').set('If-Match', `"${revision}"`).send(body)

beforeEach(async () => {
  storage.initDataFiles()
  await storage.writeSettings({ ai: { apiKey: 'test-secret', model: 'old' }, defaultTheme: 'black' })
})
afterEach(() => vi.restoreAllMocks())
afterAll(async () => {
  await fs.remove(fixture.root)
  for (const [key, value] of [['SLIDES_DATA_DIR', fixture.previous.data], ['SLIDES_UPLOADS_DIR', fixture.previous.uploads]]) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('Settings revision and atomic HTTP update', () => {
  it('reads legacy revision 0 and commits one concurrent winner without leaking its secret', async () => {
    const initial = await request(app).get('/api/settings')
    expect(initial.body.settingsRevision).toBe(0)
    expect(initial.headers.etag).toBe('"0"')
    const responses = await Promise.all([put({ defaultTheme: 'white' }), put({ ai: { model: 'new' } })])
    expect(responses.map(r => r.status).sort()).toEqual([200, 412])
    const winner = responses.find(r => r.status === 200)
    const persisted = await fs.readJson(storage.SETTINGS_FILE)
    expect(persisted.settingsRevision).toBe(1)
    expect(persisted.defaultTheme).toBe(winner.body.defaultTheme)
    expect(persisted.ai.model).toBe(winner.body.ai.model)
    expect(persisted.ai.apiKey).toBe('test-secret')
    expect(JSON.stringify(responses.map(r => r.body))).not.toContain('test-secret')
    const bytes = await fs.readFile(storage.SETTINGS_FILE, 'utf8')
    expect((await put({ defaultTheme: 'stale' })).status).toBe(412)
    expect(await fs.readFile(storage.SETTINGS_FILE, 'utf8')).toBe(bytes)
  })

  it.each([undefined, '*', '0', 'W/"0"', '"-1"', '"1.1"', '"9007199254740992"'])(
    'rejects absent or malformed precondition %s without changing bytes', async (header) => {
      const bytes = await fs.readFile(storage.SETTINGS_FILE, 'utf8')
      const req = request(app).put('/api/settings')
      if (header !== undefined) req.set('If-Match', header)
      const response = await req.send({ defaultTheme: 'white' })
      expect(response.status).toBe(header === undefined ? 428 : 400)
      expect(await fs.readFile(storage.SETTINGS_FILE, 'utf8')).toBe(bytes)
    }
  )

  it('rejects client revision authority', async () => {
    const bytes = await fs.readFile(storage.SETTINGS_FILE, 'utf8')
    expect((await put({ settingsRevision: 50 })).status).toBe(400)
    expect(await fs.readFile(storage.SETTINGS_FILE, 'utf8')).toBe(bytes)
  })

  it('preserves committed revisions, immutable response snapshots and explicit key intent', async () => {
    const first = await put({ ai: { model: 'next', apiKey: '***configured***' } })
    expect(first.status).toBe(200)
    const second = await put({ ai: { apiKey: '' } }, first.body.settingsRevision)
    expect(second.status).toBe(200)
    const third = await put({ ai: { apiKey: 'replacement' } }, second.body.settingsRevision)
    expect(third.status).toBe(200)
    expect(first.body).toMatchObject({ settingsRevision: 1, ai: { model: 'next', apiKey: '***configured***' } })
    expect(second.body).toMatchObject({ settingsRevision: 2, ai: { apiKey: '' } })
    expect(third.body).toMatchObject({ settingsRevision: 3, ai: { apiKey: '***configured***' } })
    expect(await fs.readJson(storage.SETTINGS_FILE)).toMatchObject({ settingsRevision: 3, ai: { apiKey: 'replacement', model: 'next' } })
    expect((await request(app).get('/api/settings')).body.settingsRevision).toBe(3)
  })

  it('preserves bytes/revision on precommit failure and releases the lock for the next writer', async () => {
    const bytes = await fs.readFile(storage.SETTINGS_FILE, 'utf8')
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('fault'), { code: 'EIO' }))
    expect((await put({ defaultTheme: 'white' })).status).toBe(500)
    expect(await fs.readFile(storage.SETTINGS_FILE, 'utf8')).toBe(bytes)
    expect((await put({ defaultTheme: 'white' })).body.settingsRevision).toBe(1)
  })

  it('fails closed on malformed stored JSON', async () => {
    await fs.writeFile(storage.SETTINGS_FILE, '{broken')
    expect((await put({ defaultTheme: 'white' })).status).toBe(500)
    expect(await fs.readFile(storage.SETTINGS_FILE, 'utf8')).toBe('{broken')
  })
})
