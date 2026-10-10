import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
let root, storage, ownership
const owner = 'project-import:session-a'

function resetModules() {
  vi.resetModules()
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) delete require.cache[key]
  }
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-media-rollback-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  resetModules()
  storage = require('./storage')
  storage.initDataFiles()
  ownership = require('./media-placement-ownership')
})
afterEach(async () => {
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  resetModules()
  await fs.remove(root)
})
async function seed(filename = 'unsafe.png', uploadsDir = storage.UPLOADS_DIR) {
  await fs.ensureDir(uploadsDir)
  const ledger = { global: {
    first: { filename: 'first.png', state: 'pending', placementOwner: owner },
    unsafe: { filename, state: 'pending', placementOwner: owner },
    retained: { filename: 'retained.png', state: 'committed', presentationId: 'winner' },
  }, winner: { asset: { filename: 'retained.png', state: 'committed' } } }
  await fs.writeJson(storage.UPLOAD_HASHES_FILE, ledger, { spaces: 2 })
  await fs.writeFile(path.join(uploadsDir, 'first.png'), 'first pending bytes')
  await fs.writeFile(path.join(uploadsDir, 'retained.png'), 'retained bytes')
  return fs.readFile(storage.UPLOAD_HASHES_FILE, 'utf8')
}
async function refuse(before, uploadsDir = storage.UPLOADS_DIR, actualDir = uploadsDir) {
  await expect(ownership.rollbackOwner('session-a', { uploadsDir })).rejects.toMatchObject({
    code: 'PROJECT_IMPORT_RECOVERY_REQUIRED',
  })
  expect(await fs.readFile(storage.UPLOAD_HASHES_FILE, 'utf8')).toBe(before)
  expect(await fs.readFile(path.join(actualDir, 'first.png'), 'utf8')).toBe('first pending bytes')
  expect(await fs.readFile(path.join(actualDir, 'retained.png'), 'utf8')).toBe('retained bytes')
}

it.each(['unsafe.png', 'unsafe.png.project-import-part'])('refuses a pending %s directory before touching the first valid entry', async target => {
  const before = await seed()
  const child = path.join(storage.UPLOADS_DIR, target, 'retained-child')
  await fs.outputFile(child, 'directory child bytes')
  await refuse(before)
  expect(await fs.readFile(child, 'utf8')).toBe('directory child bytes')
})

it.each(['root', 'ancestor'])('refuses an uploads %s junction into foreign retained bytes', async kind => {
  const foreign = path.join(root, 'foreign')
  const uploadsDir = kind === 'root' ? path.join(root, 'redirect') : path.join(root, 'redirect', 'uploads')
  const actualDir = kind === 'root' ? foreign : path.join(foreign, 'uploads')
  const before = await seed('unsafe.png', actualDir)
  await fs.writeFile(path.join(actualDir, 'unsafe.png'), 'foreign retained bytes')
  await fs.symlink(foreign, path.join(root, 'redirect'), 'junction')
  await refuse(before, uploadsDir, actualDir)
  expect(await fs.readFile(path.join(actualDir, 'unsafe.png'), 'utf8')).toBe('foreign retained bytes')
  expect((await fs.lstat(path.join(root, 'redirect'))).isSymbolicLink()).toBe(true)
})

it.each(['unsafe.png', 'unsafe.png.project-import-part'])('refuses pending %s file symlinks without unlinking them', async target => {
  const before = await seed()
  const foreign = path.join(root, 'foreign-file')
  await fs.writeFile(foreign, 'foreign retained bytes')
  const link = path.join(storage.UPLOADS_DIR, target)
  await fs.symlink(foreign, link, 'file')
  await refuse(before)
  expect((await fs.lstat(link)).isSymbolicLink()).toBe(true)
  expect(await fs.readFile(foreign, 'utf8')).toBe('foreign retained bytes')
})

it.each(['../unsafe.png', '..\\unsafe.png', '/foreign/unsafe.png', 'C:\\foreign\\unsafe.png', 'C:unsafe.png', '', '.', '..'])('does not launder corrupt ledger filename %j into deletion authority', async filename => {
  const before = await seed(filename)
  const victim = path.join(storage.UPLOADS_DIR, 'unsafe.png')
  await fs.writeFile(victim, 'unowned same basename bytes')
  await refuse(before)
  expect(await fs.readFile(victim, 'utf8')).toBe('unowned same basename bytes')
})

it('protects both file and part when another bucket retains the same filename', async () => {
  await seed()
  const ledger = await fs.readJson(storage.UPLOAD_HASHES_FILE)
  ledger.winner.asset.filename = 'unsafe.png'
  await fs.writeJson(storage.UPLOAD_HASHES_FILE, ledger)
  const directory = path.join(storage.UPLOADS_DIR, 'unsafe.png')
  const part = `${directory}.project-import-part`
  await fs.outputFile(path.join(directory, 'retained-child'), 'retained directory bytes')
  await fs.writeFile(part, 'retained part bytes')
  await expect(ownership.rollbackOwner('session-a')).resolves.toEqual({ removed: 2 })
  expect(await fs.readFile(path.join(directory, 'retained-child'), 'utf8')).toBe('retained directory bytes')
  expect(await fs.readFile(part, 'utf8')).toBe('retained part bytes')
  expect((await fs.readJson(storage.UPLOAD_HASHES_FILE)).winner).toEqual(ledger.winner)
})

it('unlinks exact owned regular files and parts while allowing missing pending bytes', async () => {
  await seed()
  const part = path.join(storage.UPLOADS_DIR, 'unsafe.png.project-import-part')
  await fs.writeFile(part, 'pending part bytes')
  await expect(ownership.rollbackOwner('session-a')).resolves.toEqual({ removed: 2 })
  expect(await fs.pathExists(part)).toBe(false)
  expect(await fs.pathExists(path.join(storage.UPLOADS_DIR, 'first.png'))).toBe(false)
  expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual({
    global: { retained: { filename: 'retained.png', state: 'committed', presentationId: 'winner' } },
    winner: { asset: { filename: 'retained.png', state: 'committed' } },
  })
})

it.each(['rollback', 'expiry'])('preserves all authoritative ledgers and staged bytes on unsafe upload %s', async operation => {
  const sessions = require('./project-import-media-session')
  const staged = path.join(root, 'source.png')
  await fs.writeFile(staged, 'staged bytes')
  const admitted = await sessions.createProjectImportSession({
    archiveDigest: 'a'.repeat(64), payloadDigest: 'b'.repeat(64), activeContent: [],
    trustedAuthorActiveContentAcknowledged: false,
    presentation: { title: 'Source', slides: [{ id: 'slide', elements: [] }] },
    media: [{ archivePath: 'media/source.png', originalUrl: '/uploads/source.png',
      filename: 'source.png', mimeType: 'image/png', stagingPath: staged }],
  })
  await sessions.stageProjectImportMedia(admitted)
  const record = await sessions.readProjectImportSession(admitted.sessionId)
  const hashes = await fs.readJson(storage.UPLOAD_HASHES_FILE)
  const pending = Object.values(hashes.global).find(item => item.placementOwner === `project-import:${admitted.sessionId}`)
  const upload = path.join(storage.UPLOADS_DIR, pending.filename)
  await fs.unlink(upload)
  const child = path.join(upload, 'retained-child')
  await fs.outputFile(child, 'retained upload child')
  const ledgers = [storage.UPLOAD_HASHES_FILE, path.join(storage.DATA_DIR, 'project-import-sessions.json'),
    path.join(storage.DATA_DIR, 'presentations.json')]
  const before = await Promise.all(ledgers.map(file => fs.readFile(file)))
  await expect(operation === 'rollback' ? sessions.rollbackProjectImport(admitted)
    : sessions.expirePendingProjectImports(Date.now() + 60 * 60 * 1000))
    .rejects.toMatchObject({ code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503 })
  expect(await Promise.all(ledgers.map(file => fs.readFile(file)))).toEqual(before)
  expect(await fs.readFile(child, 'utf8')).toBe('retained upload child')
  expect(await fs.readFile(record.media[0].stagingPath, 'utf8')).toBe('staged bytes')
})
