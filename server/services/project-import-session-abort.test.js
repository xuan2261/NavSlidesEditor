import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)
let root, storage, store, admitted
function reset() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}server${path.sep}`)) delete require.cache[key]
  }
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-session-abort-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  reset()
  storage = require('./storage')
  storage.initDataFiles()
  store = require('./project-import-media-session-store')
  admitted = await require('./project-import-media-session').createProjectImportSession({
    archiveDigest: 'a'.repeat(64), payloadDigest: 'b'.repeat(64), activeContent: [], media: [],
    trustedAuthorActiveContentAcknowledged: false, presentation: { slides: [] },
  })
})
afterEach(async () => {
  vi.restoreAllMocks()
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  reset()
  await fs.remove(root)
})
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
describe('P09-R2 authoritative session publication cancellation', () => {
  it('aborts after callback and real candidate write without replacing durable session bytes', async () => {
    const before = await fs.readFile(store.SESSION_FILE)
    const controller = new AbortController()
    const candidateWritten = deferred()
    const resume = deferred()
    const write = fs.writeJson.bind(fs)
    let candidate
    let callbackPassed = false
    vi.spyOn(fs, 'writeJson').mockImplementation(async (filename, ...args) => {
      await write(filename, ...args)
      if (filename.startsWith(`${store.SESSION_FILE}.tmp.`)) {
        candidate = filename
        candidateWritten.resolve()
        await resume.promise
      }
    })
    const pending = store.updateSession(admitted.sessionId, (record) => {
      callbackPassed = true
      return { record: { ...record, warnings: ['must-not-publish'] } }
    }, { signal: controller.signal })
    const outcome = pending.then(() => null, (error) => error)
    await candidateWritten.promise
    try {
      expect(callbackPassed).toBe(true)
      expect(await fs.pathExists(candidate)).toBe(true)
      controller.abort()
    } finally { resume.resolve() }
    expect(await outcome).toMatchObject({ name: 'AbortError' })
    expect(await fs.readFile(store.SESSION_FILE)).toEqual(before)
    expect(await fs.pathExists(candidate)).toBe(false)
    expect((await store.readSession(admitted.sessionId)).warnings).toEqual([])
  })
  it('rejects an aborted writer at queue entrance without invoking its callback', async () => {
    const before = await fs.readFile(store.SESSION_FILE)
    const entered = deferred()
    const resume = deferred()
    const held = storage.withFileLock(store.SESSION_FILE, async () => {
      entered.resolve()
      await resume.promise
    })
    await entered.promise
    const controller = new AbortController()
    let invoked = false
    const pending = store.updateSession(admitted.sessionId, (record) => {
      invoked = true
      return { record: { ...record, warnings: ['queued-write'] } }
    }, { signal: controller.signal })
    const outcome = pending.then(() => null, (error) => error)
    controller.abort()
    resume.resolve()
    await held
    expect(await outcome).toMatchObject({ name: 'AbortError' })
    expect(invoked).toBe(false)
    expect(await fs.readFile(store.SESSION_FILE)).toEqual(before)
  })
  it.each(['commit', 'reconcile', 'expiry'])('propagates cancellation into the %s recovery ledger publication', async (transition) => {
    const sessions = require('./project-import-media-session')
    if (transition !== 'expiry') {
      const record = await sessions.beginProjectImportCommit(admitted)
      if (transition === 'reconcile') {
        await storage.withPresentations((rows) => {
          rows.push({ id: record.intendedPresentationId, title: 'Retained foreign', slides: [] })
        })
      }
    }
    const before = await fs.readFile(store.SESSION_FILE)
    const controller = new AbortController()
    const candidateWritten = deferred()
    const resume = deferred()
    const write = fs.writeJson.bind(fs)
    let candidate
    vi.spyOn(fs, 'writeJson').mockImplementation(async (filename, ...args) => {
      await write(filename, ...args)
      if (filename.startsWith(`${store.SESSION_FILE}.tmp.`)) {
        candidate = filename
        candidateWritten.resolve()
        await resume.promise
      }
    })
    const options = { signal: controller.signal }
    const pending = transition === 'expiry'
      ? sessions.expirePendingProjectImports(Date.now() + 60 * 60 * 1000, options)
      : sessions.recoverProjectImports(options)
    const outcome = pending.then(() => null, (error) => error)
    await candidateWritten.promise
    controller.abort()
    resume.resolve()
    expect(await outcome).toMatchObject({ name: 'AbortError' })
    expect(await fs.readFile(store.SESSION_FILE)).toEqual(before)
    expect(await fs.pathExists(candidate)).toBe(false)
  })
})
