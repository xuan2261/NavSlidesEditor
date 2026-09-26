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
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) {
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

    await expect(sessions.publishProjectImport({
      sessionId: admitted.sessionId,
      capability: admitted.sessionId,
      trustedAuthorActiveContentAcknowledged: false,
    })).rejects.toMatchObject({ code: 'PROJECT_IMPORT_CAPABILITY_INVALID', status: 403 })
  })

  it('publishes once through committing and makes rollback ineligible', async () => {
    const admitted = await sessions.createProjectImportSession(validated())
    const receipt = await sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: false,
    })
    expect(receipt).toMatchObject({ status: 'committed', presentationId: expect.any(String) })
    expect(await storage.readPresentations()).toHaveLength(1)
    await expect(sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: false,
    })).resolves.toEqual(receipt)
    expect(await storage.readPresentations()).toHaveLength(1)
    await expect(sessions.rollbackProjectImport(admitted))
      .rejects.toMatchObject({ code: 'PROJECT_IMPORT_NOT_ROLLBACKABLE', status: 409 })
  })

  it('requires active-content acknowledgement again at publish', async () => {
    const admitted = await sessions.createProjectImportSession(validated({
      activeContent: ['html-element'],
      trustedAuthorActiveContentAcknowledged: true,
      presentation: {
        title: 'Active',
        slides: [{
          id: 's1',
          elements: [{ id: 'e1', type: 'html', content: '<script>demo()</script>' }],
        }],
      },
    }))
    await expect(sessions.publishProjectImport({
      sessionId: admitted.sessionId,
      capability: admitted.capability,
    }))
      .rejects.toMatchObject({ code: 'ACTIVE_CONTENT_ACK_REQUIRED', status: 409 })
    const receipt = await sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: true,
    })
    const stored = (await storage.readPresentations()).find((item) => item.id === receipt.presentationId)
    expect(stored.slides[0].elements[0].content).toBe('<script>demo()</script>')
  })

  it('places archive media and publishes rewritten upload URLs', async () => {
    const stagingPath = path.join(root, 'staged.png')
    await fs.writeFile(stagingPath, 'image-bytes')
    const admitted = await sessions.createProjectImportSession(validated({
      presentation: {
        title: 'Media',
        slides: [{
          id: 's1',
          elements: [{
            id: 'e1', type: 'image', x: 0, y: 0, width: 10, height: 10,
            src: '/uploads/source.png',
          }],
        }],
      },
      media: [{
        archivePath: 'media/source.png',
        originalUrl: '/uploads/source.png',
        filename: 'source.png',
        mimeType: 'image/png',
        stagingPath,
      }],
    }))
    await sessions.stageProjectImportMedia(admitted)
    const receipt = await sessions.publishProjectImport({
      ...admitted,
      trustedAuthorActiveContentAcknowledged: false,
    })
    const stored = (await storage.readPresentations()).find((item) => item.id === receipt.presentationId)
    expect(stored.slides[0].elements[0].src).toMatch(/^\/uploads\/[a-f0-9]{64}\.png$/u)
    await expect(fs.pathExists(stagingPath)).resolves.toBe(false)
  })

  it('expires only pending sessions and leaves committing sessions recoverable', async () => {
    const pending = await sessions.createProjectImportSession(validated())
    const committing = await sessions.createProjectImportSession(validated({
      archiveDigest: 'c'.repeat(64),
      payloadDigest: 'd'.repeat(64),
    }))
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
})
