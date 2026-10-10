import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
let root, storage, sessions, ledger
function reset() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}server${path.sep}`)) delete require.cache[key]
  }
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-staging-authority-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  reset()
  storage = require('./storage')
  storage.initDataFiles()
  await fs.writeJson(storage.UPLOAD_HASHES_FILE, {})
  sessions = require('./project-import-media-session')
  ledger = path.join(storage.DATA_DIR, 'project-import-sessions.json')
})
afterEach(async () => {
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  reset()
  await fs.remove(root)
})
async function admit(label = 'source') {
  const stagingPath = path.join(root, `${label}.png`)
  await fs.writeFile(stagingPath, `${label}-bytes`)
  return sessions.createProjectImportSession({
    archiveDigest: 'a'.repeat(64), payloadDigest: 'b'.repeat(64), activeContent: [],
    trustedAuthorActiveContentAcknowledged: false,
    presentation: { title: label, slides: [{ id: 's1', elements: [] }] },
    media: [{ archivePath: 'media/source.png', originalUrl: '/uploads/source.png',
      filename: 'source.png', mimeType: 'image/png', stagingPath }],
  })
}
async function capture() {
  return Promise.all([ledger, storage.UPLOAD_HASHES_FILE,
    path.join(storage.DATA_DIR, 'presentations.json')].map((file) => fs.readFile(file)))
}
async function act(operation, admitted) {
  if (operation === 'recovery') return sessions.recoverProjectImports()
  if (operation === 'rollback') return sessions.rollbackProjectImport(admitted)
  return sessions.expirePendingProjectImports(Date.now() + 60 * 60 * 1000)
}
describe('P09-R1 session staging deletion authority', () => {
  for (const operation of ['recovery', 'rollback', 'expiry']) {
    it.each(['winner upload', 'immutable Original', 'sibling session'])(
      `${operation} retains %s and every authoritative ledger for a schema-shaped foreign staging path`,
      async (target) => {
        const ownership = require('./media-placement-ownership')
        const winner = await ownership.placeMedia({ ownerId: 'retained-owner',
          bytes: Buffer.from('winner-bytes'), originalName: 'winner.png', sourceKey: 'winner' })
        await ownership.commitOwner('retained-owner', 'retained-presentation')
        const original = path.join(storage.DATA_DIR, 'pptx-originals', 'retained.pptx')
        await fs.writeFile(original, 'immutable-original-bytes')
        const sibling = await admit('sibling')
        const siblingRecord = await sessions.readProjectImportSession(sibling.sessionId)
        const foreign = target === 'winner upload' ? winner.absolutePath : target === 'immutable Original'
          ? original : siblingRecord.media[0].stagingPath
        const admitted = await admit()
        if (operation === 'recovery') {
          await sessions.stageProjectImportMedia(admitted)
          await sessions.beginProjectImportCommit(admitted)
        }
        const records = await fs.readJson(ledger)
        records[admitted.sessionId].stagingRoot = path.join(storage.DATA_DIR, 'project-import-staging', admitted.sessionId)
        records[admitted.sessionId].media[0].stagingPath = foreign
        await fs.writeJson(ledger, records)
        const before = await capture()
        const bytes = await fs.readFile(foreign)
        await expect(act(operation, admitted)).rejects.toMatchObject({
          code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503,
        })
        expect(await fs.readFile(foreign)).toEqual(bytes)
        expect(await capture()).toEqual(before)
      },
    )
  }
  it.each(['recovery', 'rollback', 'expiry'])('retains a legacy record without root during %s', async (operation) => {
    const admitted = await admit()
    if (operation === 'recovery') {
      await sessions.stageProjectImportMedia(admitted)
      await sessions.beginProjectImportCommit(admitted)
    }
    const records = await fs.readJson(ledger)
    delete records[admitted.sessionId].stagingRoot
    await fs.writeJson(ledger, records)
    const before = await capture()
    const bytes = await fs.readFile(records[admitted.sessionId].media[0].stagingPath)
    await expect(act(operation, admitted)).rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED' })
    expect(await capture()).toEqual(before)
    expect(await fs.readFile(records[admitted.sessionId].media[0].stagingPath)).toEqual(bytes)
  })
  it.each(['recovery', 'rollback', 'expiry'].flatMap((operation) =>
    ['root', 'media directory'].map((component) => [operation, component])))('rejects %s through a symlinked %s before changing authority', async (operation, component) => {
    const admitted = await admit()
    if (operation === 'recovery') {
      await sessions.stageProjectImportMedia(admitted)
      await sessions.beginProjectImportCommit(admitted)
    }
    const records = await fs.readJson(ledger)
    const ownedRoot = path.join(storage.DATA_DIR, 'project-import-staging', admitted.sessionId)
    const external = path.join(root, 'external')
    await fs.ensureDir(path.join(external, 'media'))
    const retained = path.join(external, 'media', 'source.png')
    await fs.writeFile(retained, 'retained-external-bytes')
    const link = component === 'root' ? ownedRoot : path.join(ownedRoot, 'media')
    await fs.remove(link)
    await fs.ensureDir(path.dirname(link))
    await fs.symlink(component === 'root' ? external : path.join(external, 'media'), link, 'junction')
    records[admitted.sessionId].stagingRoot = ownedRoot
    records[admitted.sessionId].media[0].stagingPath = path.join(ownedRoot, 'media', 'source.png')
    await fs.writeJson(ledger, records)
    const before = await capture()
    await expect(act(operation, admitted)).rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED' })
    expect(await fs.readFile(retained, 'utf8')).toBe('retained-external-bytes')
    expect(await capture()).toEqual(before)
  })
  it('binds durable root and archive path at admission, then removes only owned staging', async () => {
    const admitted = await admit()
    const record = await sessions.readProjectImportSession(admitted.sessionId)
    const expectedRoot = path.join(storage.DATA_DIR, 'project-import-staging', admitted.sessionId)
    expect(record.stagingRoot).toBe(expectedRoot)
    expect(record.media[0].stagingPath).toBe(path.join(expectedRoot, 'media', 'source.png'))
    expect(await fs.readFile(record.media[0].stagingPath, 'utf8')).toBe('source-bytes')
    await sessions.rollbackProjectImport(admitted)
    expect(await fs.pathExists(record.media[0].stagingPath)).toBe(false)
  })
  it.each(['committed', 'rolled-back'])('starts a relocated backup with a %s terminal receipt without cleanup authority', async (state) => {
    const admitted = await admit()
    let presentationId
    if (state === 'committed') {
      await sessions.stageProjectImportMedia(admitted)
      presentationId = (await sessions.publishProjectImport(admitted)).presentationId
    } else await sessions.rollbackProjectImport(admitted)
    const before = await fs.readFile(ledger)
    const restoredRoot = path.join(root, 'relocated')
    await fs.copy(storage.DATA_DIR, path.join(restoredRoot, 'data'))
    await fs.copy(storage.UPLOADS_DIR, path.join(restoredRoot, 'uploads'))
    process.env.SLIDES_DATA_DIR = path.join(restoredRoot, 'data')
    process.env.SLIDES_UPLOADS_DIR = path.join(restoredRoot, 'uploads')
    reset()
    const application = require('../index')
    const server = await application.startServer(0)
    try {
      expect((await request(application.app).get('/health/ready')).status).toBe(200)
      expect(await fs.readFile(path.join(restoredRoot, 'data', 'project-import-sessions.json'))).toEqual(before)
      expect(await fs.readFile(ledger)).toEqual(before)
      if (presentationId) {
        const opened = await request(application.app).get(`/api/presentations/${presentationId}`)
        expect(opened.status).toBe(200)
        expect(opened.body.title).toBe('source (Imported)')
      }
    } finally { await application.stopServer(server) }
  })
})
