import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const require = createRequire(import.meta.url)

let root
let ownership

function resetCjsModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}NavSlidesEditor${path.sep}server${path.sep}`)) {
      delete require.cache[key]
    }
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-media-owner-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  vi.resetModules()
  resetCjsModules()
  const storage = require('./storage')
  storage.initDataFiles()
  ownership = require('./media-placement-ownership')
})

afterEach(async () => {
  delete process.env.SLIDES_DATA_DIR
  delete process.env.SLIDES_UPLOADS_DIR
  vi.resetModules()
  resetCjsModules()
  await fs.remove(root)
})

describe('media placement ownership', () => {
  it('records exact new ownership and removes only that file on rollback', async () => {
    const placed = await ownership.placeMedia({
      ownerId: 'session-a',
      bytes: Buffer.from('image-a'),
      originalName: 'a.png',
      mimeType: 'image/png',
      sourceKey: 'media/a.png',
    })
    expect(placed.ownership).toBe('new')
    await expect(fs.pathExists(placed.absolutePath)).resolves.toBe(true)

    await ownership.rollbackOwner('session-a')
    await expect(fs.pathExists(placed.absolutePath)).resolves.toBe(false)
    await expect(ownership.rollbackOwner('session-a')).resolves.toEqual({ removed: 0 })
  })

  it('never claims or deletes a reused pre-existing file', async () => {
    const first = await ownership.placeMedia({
      ownerId: 'session-a',
      bytes: Buffer.from('same'),
      originalName: 'a.png',
      mimeType: 'image/png',
    })
    await ownership.commitOwner('session-a', 'deck-a')
    const reused = await ownership.placeMedia({
      ownerId: 'session-b',
      bytes: Buffer.from('same'),
      originalName: 'other.png',
      mimeType: 'image/png',
    })
    expect(reused).toMatchObject({ ownership: 'reused', filename: first.filename })

    await ownership.rollbackOwner('session-b')
    await expect(fs.readFile(first.absolutePath, 'utf8')).resolves.toBe('same')
  })

  it('does not reuse another pending session file', async () => {
    const first = await ownership.placeMedia({
      ownerId: 'session-a',
      bytes: Buffer.from('same'),
      originalName: 'a.png',
      mimeType: 'image/png',
    })
    const second = await ownership.placeMedia({
      ownerId: 'session-b',
      bytes: Buffer.from('same'),
      originalName: 'a.png',
      mimeType: 'image/png',
    })
    expect(second).toMatchObject({ ownership: 'new' })
    expect(second.filename).not.toBe(first.filename)
  })
})
