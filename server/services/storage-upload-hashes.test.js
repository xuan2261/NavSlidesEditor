import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import path from 'node:path'
import os from 'node:os'

const require = createRequire(import.meta.url)
const modulePath = require.resolve('./storage.js')

describe('Upload hash ledger preservation', () => {
  let root, storage, previousDirectory, previousModule
  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-hash-preservation-'))
    previousDirectory = process.env.SLIDES_DATA_DIR
    previousModule = require.cache[modulePath]
    process.env.SLIDES_DATA_DIR = root
    delete require.cache[modulePath]
    storage = require(modulePath)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    if (previousDirectory === undefined) delete process.env.SLIDES_DATA_DIR
    else process.env.SLIDES_DATA_DIR = previousDirectory
    delete require.cache[modulePath]
    if (previousModule) require.cache[modulePath] = previousModule
    await fs.remove(root)
  })

  it('creates a genuinely missing ledger and persists the elected media owner', async () => {
    await storage.withUploadHashes(hashes => {
      hashes.global = { digest: { filename: 'winner.png', placementOwner: 'pptx-import:job', state: 'pending' } }
    })
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual({
      global: { digest: { filename: 'winner.png', placementOwner: 'pptx-import:job', state: 'pending' } },
    })
  })

  it('retains malformed JSON instead of replacing ownership with an empty ledger', async () => {
    const corrupt = '{"global":{"winner":'
    await fs.writeFile(storage.UPLOAD_HASHES_FILE, corrupt)
    const mutation = vi.fn(hashes => { hashes.global = {} })
    await expect(storage.withUploadHashes(mutation)).rejects.toThrow(SyntaxError)
    expect(mutation).not.toHaveBeenCalled()
    expect(await fs.readFile(storage.UPLOAD_HASHES_FILE, 'utf8')).toBe(corrupt)
  })

  it.each([[null], [[]], [7]])('rejects an invalid ledger root without changing its bytes: %j', async (value) => {
    const bytes = JSON.stringify(value)
    await fs.writeFile(storage.UPLOAD_HASHES_FILE, bytes)
    const media = path.join(root, 'winner.png')
    await fs.writeFile(media, 'committed media bytes')
    await expect(storage.withUploadHashes(() => fs.unlink(media))).rejects.toThrow()
    expect(await fs.readFile(storage.UPLOAD_HASHES_FILE, 'utf8')).toBe(bytes)
    expect(await fs.readFile(media, 'utf8')).toBe('committed media bytes')
  })

  it.each(['EIO', 'EACCES', 'EBUSY'])('preserves ownership after %s and releases the lock for a later healthy mutation', async (code) => {
    const before = { global: { winner: { filename: 'winner.png', state: 'committed' } } }
    await fs.writeJson(storage.UPLOAD_HASHES_FILE, before)
    const nativeFs = require('fs-extra')
    const read = vi.spyOn(nativeFs, 'readJson').mockRejectedValueOnce(Object.assign(new Error('disk read failed'), { code }))
    const mutation = vi.fn(hashes => { delete hashes.global })
    await expect(storage.withUploadHashes(mutation)).rejects.toMatchObject({ code })
    read.mockRestore()
    expect(mutation).not.toHaveBeenCalled()
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual(before)
    await storage.withUploadHashes(hashes => { hashes.other = { digest: { filename: 'later.png' } } })
    expect(await fs.readJson(storage.UPLOAD_HASHES_FILE)).toEqual({
      ...before, other: { digest: { filename: 'later.png' } },
    })
  })
})
