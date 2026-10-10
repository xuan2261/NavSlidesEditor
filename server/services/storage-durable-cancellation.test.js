import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const nativeFs = require('fs-extra')
const modules = ['./storage.js', './media-placement-ownership.js'].map(name => require.resolve(name))
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
let root, storage, ownership, previousEnv, previousModules

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'durable-json-cancel-'))
  previousEnv = [process.env.SLIDES_DATA_DIR, process.env.SLIDES_UPLOADS_DIR]
  previousModules = modules.map(file => require.cache[file])
  process.env.SLIDES_DATA_DIR = root
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  modules.forEach(file => { delete require.cache[file] })
  storage = require(modules[0])
  ownership = require(modules[1])
  await fs.ensureDir(storage.UPLOADS_DIR)
})
afterEach(async () => {
  vi.restoreAllMocks()
  ;['SLIDES_DATA_DIR', 'SLIDES_UPLOADS_DIR'].forEach((key, index) => {
    if (previousEnv[index] === undefined) delete process.env[key]
    else process.env[key] = previousEnv[index]
  })
  modules.forEach((file, index) => {
    delete require.cache[file]
    if (previousModules[index]) require.cache[file] = previousModules[index]
  })
  await fs.remove(root)
})

async function seedLedger() {
  const record = { filename: 'shared.png', sha256: 'a'.repeat(64), state: 'pending',
    createdBySession: true, placementOwner: 'project-import:session-a' }
  const ledger = { global: { pending: record }, winner: { retained: {
    filename: 'shared.png', state: 'committed', presentationId: 'winner' } } }
  await fs.writeJson(storage.UPLOAD_HASHES_FILE, ledger, { spaces: 2 })
  await fs.writeFile(path.join(storage.UPLOADS_DIR, 'shared.png'), 'retained winner bytes')
  return ledger
}

async function cancelPreparedWrite(target, start) {
  const before = await fs.readFile(target, 'utf8')
  const entered = deferred(), release = deferred()
  const original = nativeFs.writeJson
  const pause = vi.spyOn(nativeFs, 'writeJson').mockImplementation(async (file, ...args) => {
    const result = await original(file, ...args)
    if (file.startsWith(`${target}.tmp.`)) {
      entered.resolve()
      await release.promise
    }
    return result
  })
  const controller = new AbortController()
  const pending = start(controller.signal).then(value => ({ value }), error => ({ error }))
  await entered.promise
  controller.abort()
  release.resolve()
  const result = await pending
  pause.mockRestore()
  expect(await fs.readFile(target, 'utf8')).toBe(before)
  expect(result.error).toMatchObject({ name: 'AbortError' })
  expect((await fs.readdir(root)).filter(name => name.startsWith(`${path.basename(target)}.tmp.`))).toEqual([])
}

describe('P09-R2 durable consumer cancellation', () => {
  it('retains presentation canonical bytes after the callback passes and its candidate write is aborted', async () => {
    const rows = [{ id: 'winner', title: 'Before', slides: [] }]
    const target = path.join(root, 'presentations.json')
    await fs.writeJson(target, rows, { spaces: 2 })
    await cancelPreparedWrite(target, signal => storage.withPresentations(items => {
      items[0].title = 'Late replacement'
    }, { signal }))
    expect(await storage.readPresentations()).toEqual(rows)
  })

  it('retains upload ownership after the callback passes and its candidate write is aborted', async () => {
    const ledger = await seedLedger()
    await cancelPreparedWrite(storage.UPLOAD_HASHES_FILE, signal => storage.withUploadHashes(hashes => {
      delete hashes.global.pending
    }, { signal }))
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual(ledger)
  })

  it.each(['commitOwner', 'rollbackOwner'])('retains actual owner state and shared media when prepared %s is aborted', async operation => {
    const ledger = await seedLedger()
    await cancelPreparedWrite(storage.UPLOAD_HASHES_FILE, signal => operation === 'commitOwner'
      ? ownership.commitOwner('session-a', 'late-owner', { signal })
      : ownership.rollbackOwner('session-a', { signal }))
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual(ledger)
    expect(await fs.readFile(path.join(storage.UPLOADS_DIR, 'shared.png'), 'utf8')).toBe('retained winner bytes')
  })

  it('does not retry an authoritative presentation rename after a stalled attempt fails following abort', async () => {
    const targetFile = path.join(root, 'presentations.json')
    await fs.writeJson(targetFile, [{ id: 'winner', title: 'Before' }])
    const before = await fs.readFile(targetFile, 'utf8')
    const entered = deferred(), release = deferred()
    const original = nativeFs.rename
    let first = true
    vi.spyOn(nativeFs, 'rename').mockImplementation(async (source, target) => {
      if (target === targetFile && first) {
        first = false
        entered.resolve()
        await release.promise
        throw Object.assign(new Error('held target'), { code: 'EBUSY' })
      }
      return original(source, target)
    })
    const controller = new AbortController()
    const pending = storage.withPresentations(rows => { rows[0].title = 'Late' }, { signal: controller.signal })
      .then(value => ({ value }), error => ({ error }))
    await entered.promise
    controller.abort()
    release.resolve()
    const result = await pending
    expect(await fs.readFile(targetFile, 'utf8')).toBe(before)
    expect(result.error).toMatchObject({ name: 'AbortError' })
  })
})
