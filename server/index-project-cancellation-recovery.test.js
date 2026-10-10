// @vitest-environment node
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { launchRecoveryChild } from './recovery-test-driver'
import { reset } from './routes/portable-package-project-fixture'

const require = createRequire(import.meta.url)
const entry = new URL('./recovery-test-child.cjs', import.meta.url)
let root, storage, sessions, ledger, ownership, savedEnv
const children = []

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-session-cancel-restart-'))
  savedEnv = { SLIDES_DATA_DIR: process.env.SLIDES_DATA_DIR, SLIDES_UPLOADS_DIR: process.env.SLIDES_UPLOADS_DIR }
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  reset()
  storage = require('./services/storage')
  storage.initDataFiles()
  sessions = require('./services/project-import-media-session')
  ledger = require('./services/project-import-media-session-store')
  ownership = require('./services/media-placement-ownership')
})
afterEach(async () => {
  vi.restoreAllMocks()
  try { for (const child of children.splice(0)) await child.kill() } finally {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    reset()
    await fs.remove(root)
  }
})
async function restart() {
  const child = launchRecoveryChild(entry, root, 'restart')
  children.push(child)
  return { child, ...(await child.next('ready')) }
}
async function retained() {
  const bytes = Buffer.from('retained committed winner')
  const placed = await ownership.placeMedia({ ownerId: 'winner', bytes,
    originalName: 'winner.png', mimeType: 'image/png', sourceKey: 'winner' })
  await ownership.commitOwner('winner', 'winner')
  const winner = { id: 'winner', title: 'Retained winner', slides: [{ id: 's1',
    elements: [{ id: 'e1', type: 'image', src: `/uploads/${placed.filename}` }] }] }
  await storage.withPresentations(rows => rows.push(winner))
  const userFile = path.join(storage.UPLOADS_DIR, 'unindexed.png')
  await fs.writeFile(userFile, 'unindexed retained bytes')
  return { placed, bytes, winner, userFile, hashes: await fs.readJson(storage.UPLOAD_HASHES_FILE) }
}
async function assertRetained(fixture, url) {
  expect(await fs.readFile(fixture.placed.absolutePath)).toEqual(fixture.bytes)
  expect(await fs.readFile(fixture.userFile, 'utf8')).toBe('unindexed retained bytes')
  const response = await fetch(`${url}/api/presentations/winner`)
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject(fixture.winner)
  const hashes = await fs.readJson(storage.UPLOAD_HASHES_FILE)
  for (const [key, record] of Object.entries(fixture.hashes.global)) expect(hashes.global[key]).toEqual(record)
}
async function failedCancellation(operation) {
  const source = path.join(root, 'source.png')
  await fs.writeFile(source, 'session-owned cancellation bytes')
  const admitted = await sessions.createProjectImportSession({ archiveDigest: 'a'.repeat(64),
    payloadDigest: 'b'.repeat(64), activeContent: [], trustedAuthorActiveContentAcknowledged: false,
    presentation: { title: 'Cancelled import must never publish', slides: [] },
    media: [{ archivePath: 'media/source.png', originalUrl: '/uploads/source.png', filename: 'source.png',
      mimeType: 'image/png', stagingPath: source }] })
  await sessions.stageProjectImportMedia(admitted)
  const pending = await sessions.readProjectImportSession(admitted.sessionId)
  const unlink = fs.unlink.bind(fs)
  const fault = vi.spyOn(fs, 'unlink').mockImplementation(async (filename, ...args) => {
    if (filename === pending.placements[0].absolutePath) {
      fault.mockRestore()
      throw Object.assign(new Error('One-shot owned upload contention'), { code: 'EBUSY' })
    }
    return unlink(filename, ...args)
  })
  try {
    const action = operation === 'rollback' ? sessions.rollbackProjectImport(admitted)
      : sessions.expirePendingProjectImports(Date.parse(pending.expiresAt) + 1)
    await expect(action).rejects.toMatchObject({ code: 'EBUSY' })
  } finally { fault.mockRestore() }
  const failed = await sessions.readProjectImportSession(admitted.sessionId)
  expect(failed).toMatchObject({ state: 'reconcile-required',
    reconcileReason: operation === 'rollback' ? 'PROJECT_IMPORT_ROLLBACK_FAILED' : 'PROJECT_IMPORT_EXPIRY_FAILED' })
  expect(failed.intendedPresentationId).toBeUndefined()
  return { admitted, failed }
}
async function durableBytes() {
  return Promise.all([ledger.SESSION_FILE, storage.UPLOAD_HASHES_FILE,
    path.join(storage.DATA_DIR, 'presentations.json')].map(file => fs.readFile(file)))
}

describe('retained project cancellation recovery', () => {
  it.each(['rollback', 'expiry'])('retries failed %s intent across two actual restarts before readiness', async operation => {
    const fixture = await retained()
    const { failed } = await failedCancellation(operation)
    let terminalBytes
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { child, url } = await restart()
      expect((await fetch(`${url}/health/live`)).status).toBe(200)
      expect((await fetch(`${url}/health/ready`)).status).toBe(200)
      const record = await ledger.readSession(failed.sessionId)
      expect(record).toMatchObject({ state: 'rolled-back', replayHash: failed.capabilityHash,
        revokedAt: expect.any(String), rolledBackAt: expect.any(String) })
      expect(record.capabilityHash).toBeUndefined()
      expect(record.reconcileReason).toBeUndefined()
      const currentBytes = await fs.readFile(ledger.SESSION_FILE)
      if (terminalBytes) expect(currentBytes).toEqual(terminalBytes)
      terminalBytes = currentBytes
      for (const placed of failed.placements) expect(await fs.pathExists(placed.absolutePath)).toBe(false)
      for (const media of failed.media) expect(await fs.pathExists(media.stagingPath)).toBe(false)
      expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual(fixture.hashes)
      expect((await storage.readPresentations()).some(row => row.title === failed.presentation.title)).toBe(false)
      const response = await fetch(`${url}/api/presentations`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Ready after cancellation', slides: [] }) })
      expect(response.status).toBe(201)
      await assertRetained(fixture, url)
      await child.kill()
    }
  }, 45000)

  it.each(['rollback', 'expiry'])('allows authorized public cancellation retry after failed %s', async operation => {
    const fixture = await retained()
    const { admitted, failed } = await failedCancellation(operation)
    await expect(sessions.rollbackProjectImport(admitted)).resolves.toEqual({ status: 'rolled-back' })
    await expect(sessions.rollbackProjectImport(admitted)).resolves.toEqual({ status: 'rolled-back' })
    expect((await ledger.readSession(failed.sessionId)).state).toBe('rolled-back')
    expect(await fs.pathExists(failed.placements[0].absolutePath)).toBe(false)
    expect(await fs.pathExists(failed.media[0].stagingPath)).toBe(false)
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual(fixture.hashes)
    expect(await storage.readPresentations()).toEqual([fixture.winner])
  })

  it.each(['foreign owner', 'tampered upload', 'committed owner', 'foreign staging', 'publication recovery'])(
    'refuses %s rather than treating unrelated authority as cancellation', async variant => {
      const fixture = await retained()
      const { failed } = await failedCancellation('rollback')
      const upload = failed.placements[0].absolutePath
      let protectedFile = upload
      if (variant === 'tampered upload') await fs.writeFile(upload, 'foreign replacement bytes')
      else if (variant === 'foreign staging') {
        await fs.unlink(failed.media[0].stagingPath)
        protectedFile = path.join(failed.media[0].stagingPath, 'retained-child')
        await fs.outputFile(protectedFile, 'foreign staging bytes')
      } else if (variant === 'publication recovery') {
        await ledger.updateSession(failed.sessionId, record => ({ record: {
          ...record, reconcileReason: 'PROJECT_IMPORT_RECOVERY_FAILED' } }))
      } else {
        const hashes = await fs.readJson(storage.UPLOAD_HASHES_FILE)
        const record = Object.values(hashes.global).find(item => item.filename === failed.placements[0].filename)
        if (variant === 'foreign owner') record.placementOwner = 'project-import:foreign-session'
        else { record.state = 'committed'; record.presentationId = 'foreign-presentation'; delete record.placementOwner }
        await fs.writeJson(storage.UPLOAD_HASHES_FILE, hashes)
      }
      const before = await durableBytes(), protectedBytes = await fs.readFile(protectedFile)
      const { url } = await restart()
      expect((await fetch(`${url}/health/live`)).status).toBe(200)
      expect((await fetch(`${url}/health/ready`)).status).toBe(503)
      expect((await fetch(`${url}/api/presentations`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Must remain blocked', slides: [] }) })).status).toBe(503)
      expect(await durableBytes()).toEqual(before)
      expect(await fs.readFile(protectedFile)).toEqual(protectedBytes)
      await assertRetained(fixture, url)
    }, 30000,
  )
})
