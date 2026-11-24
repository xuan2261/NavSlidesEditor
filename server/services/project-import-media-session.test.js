import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)

let root
let sessions
let storage

function resetCjsModules() {
  const serverDir = `${path.resolve(path.dirname(require.resolve('./storage')), '..')}${path.sep}`
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(serverDir)) {
      delete require.cache[key]
    }
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-session-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  vi.resetModules()
  resetCjsModules()
  storage = require('./storage')
  storage.initDataFiles()
  sessions = require('./project-import-media-session')
})

afterEach(async () => {
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  vi.resetModules()
  resetCjsModules()
  await fs.remove(root)
})

function validated(overrides = {}) {
  return {
    archiveDigest: 'a'.repeat(64),
    payloadDigest: 'b'.repeat(64),
    presentation: { title: 'Imported', slides: [{ id: 's1', elements: [] }] },
    media: [],
    activeContent: [],
    trustedAuthorActiveContentAcknowledged: false,
    ...overrides,
  }
}

describe('project import media session', () => {
  it('stores only a salted capability hash and rejects sessionId authority', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    const durable = await sessions.readProjectImportSession(admitted.sessionId)
    expect(durable.capabilityHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(durable)).not.toContain(admitted.capability)

    await expect(
      sessions.publishProjectImport({
        sessionId: admitted.sessionId,
        capability: admitted.sessionId,
        trustedAuthorActiveContentAcknowledged: false,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_IMPORT_CAPABILITY_INVALID', status: 403 })
  })

  it('publishes once through committing and makes rollback ineligible', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    const receipt = await sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: false,
    })
    expect(receipt).toMatchObject({ status: 'committed', presentationId: expect.any(String) })
    expect(await storage.readPresentations()).toHaveLength(1)
    await expect(
      sessions.publishProjectImport({
        ...admitted,
        trustedAuthorActiveContentAcknowledged: false,
      })
    ).resolves.toEqual(receipt)
    expect(await storage.readPresentations()).toHaveLength(1)
    await expect(sessions.rollbackProjectImport(admitted)).rejects.toMatchObject({
      code: 'PROJECT_IMPORT_NOT_ROLLBACKABLE',
      status: 409,
    })
  })

  it('requires active-content acknowledgement again at publish', async () => {
    const admitted = await sessions.createProjectImportSession(
      validated({
        activeContent: ['html-element'],
        trustedAuthorActiveContentAcknowledged: true,
        presentation: {
          title: 'Active',
          slides: [
            {
              id: 's1',
              elements: [{ id: 'e1', type: 'html', content: '<script>demo()</script>' }],
            },
          ],
        },
      })
    )
    await expect(
      sessions.publishProjectImport({
        sessionId: admitted.sessionId,
        capability: admitted.capability,
      })
    ).rejects.toMatchObject({ code: 'ACTIVE_CONTENT_ACK_REQUIRED', status: 409 })
    const receipt = await sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: true,
    })
    const stored = (await storage.readPresentations()).find(
      (item) => item.id === receipt.presentationId
    )
    expect(stored.slides[0].elements[0].content).toBe('<script>demo()</script>')
  })

  it('places archive media and publishes rewritten upload URLs', async () => {
    const stagingPath = path.join(root, 'staged.png')
    await fs.writeFile(stagingPath, 'image-bytes')
    const admitted = await sessions.createProjectImportSession(
      validated({
        presentation: {
          title: 'Media',
          slides: [
            {
              id: 's1',
              elements: [
                {
                  id: 'e1',
                  type: 'image',
                  x: 0,
                  y: 0,
                  width: 10,
                  height: 10,
                  src: '/uploads/source.png',
                },
              ],
            },
          ],
        },
        media: [
          {
            archivePath: 'media/source.png',
            originalUrl: '/uploads/source.png',
            filename: 'source.png',
            mimeType: 'image/png',
            stagingPath,
          },
        ],
      })
    )
    await sessions.stageProjectImportMedia(admitted)
    const receipt = await sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: false,
    })
    const stored = (await storage.readPresentations()).find(
      (item) => item.id === receipt.presentationId
    )
    expect(stored.slides[0].elements[0].src).toMatch(/^\/uploads\/[a-f0-9]{64}\.png$/u)
    await expect(fs.pathExists(stagingPath)).resolves.toBe(false)
  })

  it('expires only pending sessions and leaves committing sessions recoverable', async () => {
    const pending = await sessions.createProjectImportSession(validated())
    const committing = await sessions.createProjectImportSession(
      validated({
        archiveDigest: 'c'.repeat(64),
        payloadDigest: 'd'.repeat(64),
      })
    )
    await sessions.beginProjectImportCommit(committing)
    await sessions.expirePendingProjectImports(Date.now() + 60 * 60 * 1000)
    expect((await sessions.readProjectImportSession(pending.sessionId)).state).toBe('rolled-back')
    expect((await sessions.readProjectImportSession(committing.sessionId)).state).toBe('committing')
  })

  it('recovers a committing publication forward without creating a duplicate', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    await sessions.beginProjectImportCommit(admitted)
    await sessions.recoverProjectImports()
    await sessions.recoverProjectImports()
    const durable = await sessions.readProjectImportSession(admitted.sessionId)
    expect(durable.state).toBe('committed')
    expect(await storage.readPresentations()).toHaveLength(1)
  })

  it('marks a conflicting visible presentation reconcile-required', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    const committing = await sessions.beginProjectImportCommit(admitted)
    await storage.withPresentations((rows) => {
      rows.push({ id: committing.intendedPresentationId, title: 'Foreign', slides: [] })
    })
    await sessions.recoverProjectImports()
    const durable = await sessions.readProjectImportSession(admitted.sessionId)
    expect(durable.state).toBe('reconcile-required')
  })
  it.each(['{"unfinished":', '[]', '{"foreign":{"sessionId":"different","state":"committing"}}'])(
    'P09-13 preserves invalid durable ledger instead of admitting over it: %s', async (bytes) => {
      const ledger = path.join(storage.DATA_DIR, 'project-import-sessions.json')
      await fs.writeFile(ledger, bytes)
      await expect(sessions.createProjectImportSession(validated())).rejects.toBeInstanceOf(Error)
      expect(await fs.readFile(ledger, 'utf8')).toBe(bytes)
      await expect(sessions.recoverProjectImports()).rejects.toBeInstanceOf(Error)
      expect(await fs.readFile(ledger, 'utf8')).toBe(bytes)
    },
  )

  it('P09-13 preserves unreadable ledger and its intent instead of resetting it', async () => {
    const ledger = path.join(storage.DATA_DIR, 'project-import-sessions.json')
    await fs.ensureDir(ledger)
    const intent = path.join(ledger, 'retained-intent')
    await fs.writeFile(intent, 'do-not-discard')
    await expect(sessions.createProjectImportSession(validated())).rejects.toBeInstanceOf(Error)
    expect(await fs.readFile(intent, 'utf8')).toBe('do-not-discard')
    await expect(sessions.recoverProjectImports()).rejects.toBeInstanceOf(Error)
    expect(await fs.readFile(intent, 'utf8')).toBe('do-not-discard')
  })

  it.each([
    ['mismatched key', (record) => { record.sessionId = 'foreign-session' }],
    ['missing digest', (record) => { delete record.payloadDigest }],
    ['invalid timestamp', (record) => { record.expiresAt = 'not-a-date' }],
    ['invalid media shape', (record) => { record.media = [null] }],
    ['unmatched placement', (record) => { record.placements = [{ archivePath: 'foreign' }] }],
    ['missing commit identity', (record) => { delete record.intendedPresentationId }],
  ])('P09-13 rejects %s without publishing or changing durable bytes', async (_label, corrupt) => {
    const admitted = await sessions.createProjectImportSession(validated())
    await sessions.beginProjectImportCommit(admitted)
    const ledger = path.join(storage.DATA_DIR, 'project-import-sessions.json')
    const records = await fs.readJson(ledger)
    corrupt(records[admitted.sessionId])
    await fs.writeJson(ledger, records)
    const before = await fs.readFile(ledger)
    await expect(sessions.readProjectImportSession(admitted.sessionId))
      .rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503 })
    await expect(sessions.recoverProjectImports())
      .rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503 })
    await expect(sessions.createProjectImportSession(validated()))
      .rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503 })
    expect((await fs.readFile(ledger)).equals(before)).toBe(true)
    expect(await storage.readPresentations()).toEqual([])
  })

  it('P09-08 rereads exact session under its lock instead of replaying a stale snapshot', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    const stale = await sessions.beginProjectImportCommit(admitted)
    const receipt = await sessions.publishProjectImport(admitted)
    const ledger = path.join(storage.DATA_DIR, 'project-import-sessions.json')
    const before = await fs.readFile(ledger)
    const recovery = require('./project-import-media-session-recovery')
    await expect(recovery.recoverProjectImport(stale)).resolves.toEqual(receipt)
    expect((await fs.readFile(ledger)).equals(before)).toBe(true)
    expect(await storage.readPresentations()).toHaveLength(1)
  })

  it('P09-06 retains a row whose payload changes between initial read and publication lock', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    const record = await sessions.beginProjectImportCommit(admitted)
    const dataFile = path.join(storage.DATA_DIR, 'presentations.json')
    const read = fs.readJson.bind(fs)
    let presentationReads = 0
    const foreign = { id: record.intendedPresentationId, title: 'Retained foreign payload', slides: [],
      _projectImport: { sessionId: record.sessionId, payloadDigest: 'c'.repeat(64) } }
    const spy = vi.spyOn(fs, 'readJson').mockImplementation(async (filename, ...args) => {
      if (filename === dataFile && ++presentationReads === 2) await fs.writeJson(dataFile, [foreign])
      return read(filename, ...args)
    })
    try { await sessions.recoverProjectImports() } finally { spy.mockRestore() }
    expect(await storage.readPresentations()).toEqual([foreign])
    expect((await sessions.readProjectImportSession(record.sessionId)).state).toBe('reconcile-required')
  })

  it.each(['commitOwner', 'rollbackOwner'])(
    'P09-15 aborts queued %s without changing ownership or removing bytes', async (operation) => {
      const ownership = require('./media-placement-ownership')
      const admitted = await sessions.createProjectImportSession(validated())
      const placed = await ownership.placeMedia({ ownerId: admitted.sessionId, bytes: Buffer.from('retained-media'),
        originalName: 'retained.png', mimeType: 'image/png', sourceKey: 'retained' })
      const before = await fs.readFile(storage.UPLOAD_HASHES_FILE)
      let release
      let entered
      const barrier = new Promise((resolve) => { entered = resolve })
      const held = storage.withFileLock(storage.UPLOAD_HASHES_FILE, async () => {
        entered()
        await new Promise((resolve) => { release = resolve })
      })
      await barrier
      const controller = new AbortController()
      const pending = operation === 'commitOwner'
        ? ownership.commitOwner(admitted.sessionId, 'would-be-owner', { signal: controller.signal })
        : ownership.rollbackOwner(admitted.sessionId, { signal: controller.signal })
      const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
      controller.abort()
      release()
      await held
      await rejected
      expect((await fs.readFile(storage.UPLOAD_HASHES_FILE)).equals(before)).toBe(true)
      expect(await fs.readFile(placed.absolutePath, 'utf8')).toBe('retained-media')
    },
  )
})
