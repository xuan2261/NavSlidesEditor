// @vitest-environment node
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
let root, runtime, server, storage, sessions, ledger, ownership
let savedEnv

function resetModules() {
  vi.resetModules()
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) delete require.cache[key]
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-startup-expired-project-'))
  savedEnv = Object.fromEntries(['SLIDES_DATA_DIR', 'SLIDES_UPLOADS_DIR', 'NODE_ENV'].map(key => [key, process.env[key]]))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  process.env.NODE_ENV = 'development'
  resetModules()
  storage = require('./services/storage')
  storage.initDataFiles()
  sessions = require('./services/project-import-media-session')
  ledger = require('./services/project-import-media-session-store')
  ownership = require('./services/media-placement-ownership')
  runtime = require('./index')
})

afterEach(async () => {
  try {
    if (server) await runtime.stopServer(server)
  } finally {
    server = undefined
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    resetModules()
    await fs.remove(root)
  }
})

async function retainedData() {
  const bytes = Buffer.from('committed winner media')
  const placed = await ownership.placeMedia({ ownerId: 'retained-winner', bytes,
    originalName: 'winner.png', mimeType: 'image/png', sourceKey: 'winner' })
  await ownership.commitOwner('retained-winner', 'retained-winner')
  const winner = { id: 'retained-winner', title: 'Retained winner', slides: [{ id: 's1',
    elements: [{ id: 'image', type: 'image', src: `/uploads/${placed.filename}` }] }] }
  await storage.withPresentations(rows => rows.push(winner))
  const userFile = path.join(storage.UPLOADS_DIR, 'user-upload.png')
  await fs.writeFile(userFile, 'unindexed user upload')
  const hashes = await fs.readJson(storage.UPLOAD_HASHES_FILE)
  return { winner, bytes, placed, userFile, hashes }
}

async function expiredSession(withMedia) {
  const staged = path.join(root, 'source.png')
  if (withMedia) await fs.writeFile(staged, 'expired session media')
  const admitted = await sessions.createProjectImportSession({ archiveDigest: 'a'.repeat(64),
    payloadDigest: 'b'.repeat(64), activeContent: [], trustedAuthorActiveContentAcknowledged: false,
    presentation: { title: 'Never publish expired import', slides: [{ id: 's1', elements: [] }] },
    media: withMedia ? [{ archivePath: 'media/source.png', originalUrl: '/uploads/source.png',
      filename: 'source.png', mimeType: 'image/png', stagingPath: staged }] : [] })
  if (withMedia) await sessions.stageProjectImportMedia(admitted)
  // Both timestamps remain valid ledger authority; expiration never depends on a sleep.
  await ledger.updateSession(admitted.sessionId, record => ({ record: { ...record,
    createdAt: '2000-01-01T00:00:00.000Z', expiresAt: '2000-01-01T00:30:00.000Z' } }))
  return sessions.readProjectImportSession(admitted.sessionId)
}

async function assertRetained(retained) {
  expect((await storage.readPresentations()).find(row => row.id === retained.winner.id)).toEqual(retained.winner)
  const response = await request(server).get(`/api/presentations/${retained.winner.id}`)
  expect(response.status).toBe(200)
  expect(response.body.slides[0].elements[0].src).toBe(`/uploads/${retained.placed.filename}`)
  expect(await fs.readFile(path.join(storage.UPLOADS_DIR, retained.placed.filename))).toEqual(retained.bytes)
  expect(await fs.readFile(retained.userFile, 'utf8')).toBe('unindexed user upload')
  const hashes = await fs.readJson(storage.UPLOAD_HASHES_FILE)
  for (const [bucket, records] of Object.entries(retained.hashes)) {
    for (const [key, record] of Object.entries(records)) expect(hashes[bucket][key]).toEqual(record)
  }
}

describe('startup expiration of durable pending project imports', () => {
  it.each([false, true])('Audit regression: expires pending session (owned media: %s) before readiness and admits HTTP creation', async withMedia => {
    const retained = await retainedData()
    const pending = await expiredSession(withMedia)
    expect(pending.state).toBe('pending')
    expect(pending.placements).toHaveLength(withMedia ? 1 : 0)

    server = await runtime.startServer(0, { host: '127.0.0.1' })
    const ready = await request(server).get('/health/ready')
    expect(ready.status).toBe(200)
    expect(ready.body).toMatchObject({ status: 'ready', reasons: [] })
    const created = await request(server).post('/api/presentations').send({ title: 'Allowed after safe expiry', slides: [] })
    expect(created.status).toBe(201)
    expect((await storage.readPresentations()).find(row => row.id === created.body.id)?.title).toBe('Allowed after safe expiry')

    const expired = await sessions.readProjectImportSession(pending.sessionId)
    expect(expired.state).toBe('rolled-back')
    expect(expired.capabilityHash).toBeUndefined()
    expect(expired.revokedAt).toEqual(expect.any(String))
    expect((await storage.readPresentations()).some(row => row.title === 'Never publish expired import')).toBe(false)
    for (const media of pending.media) expect(await fs.pathExists(media.stagingPath)).toBe(false)
    for (const placed of pending.placements) {
      expect(await fs.pathExists(path.join(storage.UPLOADS_DIR, placed.filename))).toBe(false)
    }
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual(retained.hashes)
    await assertRetained(retained)
  }, 20000)

  it('Audit regression: expired session with uncertain upload ownership stays degraded without sweeping retained bytes', async () => {
    const retained = await retainedData()
    const pending = await expiredSession(true)
    const upload = path.join(storage.UPLOADS_DIR, pending.placements[0].filename)
    await fs.unlink(upload)
    const child = path.join(upload, 'retained-child')
    await fs.outputFile(child, 'uncertain retained upload bytes')
    const files = [storage.UPLOAD_HASHES_FILE, ledger.SESSION_FILE, path.join(storage.DATA_DIR, 'presentations.json')]
    const before = await Promise.all(files.map(file => fs.readFile(file)))

    server = await runtime.startServer(0, { host: '127.0.0.1' })
    expect((await request(server).get('/health/live')).status).toBe(200)
    const ready = await request(server).get('/health/ready')
    expect(ready.status).toBe(503)
    expect(ready.body.reasons).toContain('DURABLE_RECOVERY_REQUIRED')
    expect((await request(server).post('/api/presentations').send({ title: 'Must stay blocked', slides: [] })).status).toBe(503)
    expect(await Promise.all(files.map(file => fs.readFile(file)))).toEqual(before)
    expect(await fs.readFile(child, 'utf8')).toBe('uncertain retained upload bytes')
    expect(await fs.readFile(pending.media[0].stagingPath, 'utf8')).toBe('expired session media')
    await assertRetained(retained)
  }, 20000)
})
