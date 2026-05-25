import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import media from './media.js'
import dedup from './media-dedup.js'
import { DATA_DIR } from '../storage.js'

const { persistImageBuffer, persistMediaBlob, MAX_MEDIA_SIZE } = media
const { persistDedupedBuffer } = dedup
const HASHES_FILE = path.join(DATA_DIR, 'upload-hashes.json')

const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 15, 0, 0, 1, 1, 0, 5, 24, 212, 205, 0, 0, 0, 59, 73, 69, 78, 68, 174, 66, 96, 130])
const validMp4 = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32])
const validMp3 = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64])
const validWav = Buffer.from([...Buffer.from('RIFF'), 0x24, 0, 0, 0, ...Buffer.from('WAVEfmt '), 16, 0, 0, 0, 1, 0, 1, 0, 0x40, 0x1f, 0, 0, 0x80, 0x3e, 0, 0, 2, 0, 16, 0, ...Buffer.from('data'), 0, 0, 0, 0])
const validOgg = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(24), Buffer.from([1]), Buffer.from([19]), Buffer.from('OpusHead'), Buffer.alloc(20)])
const validWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01, 0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02])

function mockEntry(buffer) {
  return { async: () => Promise.resolve(buffer) }
}

async function withHashFileRestored(fn) {
  let original
  try {
    original = await fs.readFile(HASHES_FILE, 'utf-8')
  } catch {
    original = null
  }
  try {
    return await fn()
  } finally {
    if (original === null) await fs.rm(HASHES_FILE, { force: true })
    else await fs.writeFile(HASHES_FILE, original)
  }
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

describe('pptx media persistence', () => {
  it('rejects files exceeding MAX_MEDIA_SIZE in persistImageBuffer', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-size-'))
    try {
      // Build a small PNG header (8-byte minimal PNG)
      const oversized = Buffer.alloc(MAX_MEDIA_SIZE + 1)
      const result = await persistImageBuffer(oversized, 'image/png', dir)
      expect(result.url).toBeNull()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('accepts files under MAX_MEDIA_SIZE in persistImageBuffer', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-ok-'))
    try {
      // Minimal 1x1 red PNG
      const result = await persistImageBuffer(validPng, 'image/png', dir)
      expect(result.url).toMatch(/^\/uploads\//)
      expect(result.warning).toBeUndefined()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects files exceeding MAX_MEDIA_SIZE in persistMediaBlob', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-blob-size-'))
    try {
      const mockEntry = { async: () => Promise.resolve(Buffer.alloc(MAX_MEDIA_SIZE + 1)) }
      const mediaIndex = { files: new Map([['ppt/media/oversized.mp4', mockEntry]]) }
      const result = await persistMediaBlob(mediaIndex, 'ppt/media/oversized.mp4', dir)
      expect(result.url).toBeNull()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Existing test ───────────────────────────────────────────────────
  it('rejects non-image payloads', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-'))
    try {
      const result = await persistImageBuffer(Buffer.from('not an image'), 'text/plain', dir)
      expect(result.url).toBeNull()
      expect(result.warning).toMatchObject({ code: 'image-detect-failed', byteLength: 12 })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('trusts sniffed image MIME when the PPTX hint disagrees', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-mismatch-'))
    try {
      const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13])
      const result = await persistImageBuffer(validPng, 'image/jpeg', dir)
      expect(result.url).toMatch(/^\/uploads\/.+\.png$/)
      expect(result.warning).toMatchObject({
        code: 'image-mime-hint-mismatch',
        detected: 'image/png',
        hinted: 'image/jpeg',
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('keeps zero-byte image payloads rejected with a warning', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-empty-'))
    try {
      const result = await persistImageBuffer(Buffer.alloc(0), 'image/png', dir)
      expect(result.url).toBeNull()
      expect(result.warning).toMatchObject({ code: 'image-detect-failed', byteLength: 0 })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('preserves EMF images instead of dropping them', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-emf-'))
    try {
      const emf = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x6c, 0x00, 0x00, 0x00])
      const result = await persistImageBuffer(emf, 'image/x-emf', dir)
      expect(result.url).toMatch(/^\/uploads\/.+\.emf$/)
      expect(result.warning).toMatchObject({
        code: 'image-format-preserved-with-limited-browser-support',
        detected: 'image/x-emf',
      })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('returns existing URL when buffer hash matches upload-hashes.json', async () => {
    await withHashFileRestored(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-dedup-'))
      try {
        const existingFilename = 'existing-image.png'
        await fs.writeFile(path.join(dir, existingFilename), validPng)
        await fs.mkdir(path.dirname(HASHES_FILE), { recursive: true })
        await fs.writeFile(HASHES_FILE, JSON.stringify({
          'pptx-import-test': {
            [sha256(validPng)]: { filename: existingFilename },
          },
        }))

        const result = await persistImageBuffer(validPng, 'image/png', dir)
        expect(result.url).toBe(`/uploads/${existingFilename}`)
        expect(await fs.readdir(dir)).toEqual([existingFilename])
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  it('rejects disallowed media extensions before writing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-ext-'))
    try {
      const mediaIndex = { files: new Map([['ppt/media/image1.html', mockEntry(Buffer.from('<script>x</script>'))]]) }
      const result = await persistMediaBlob(mediaIndex, 'ppt/media/image1.html', dir)
      expect(result.url).toBeNull()
      expect(result.warning).toMatchObject({ code: 'media-extension-rejected', ext: 'html' })
      expect(await fs.readdir(dir).catch(() => [])).toHaveLength(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects svg and dotless media refs', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-ext-empty-'))
    try {
      const mediaIndex = {
        files: new Map([
          ['ppt/media/icon.svg', mockEntry(Buffer.from('<svg></svg>'))],
          ['ppt/media/blob', mockEntry(validMp4)],
        ]),
      }
      const svg = await persistMediaBlob(mediaIndex, 'ppt/media/icon.svg', dir)
      const dotless = await persistMediaBlob(mediaIndex, 'ppt/media/blob', dir)
      expect(svg.warning).toMatchObject({ code: 'media-extension-rejected', ext: 'svg' })
      expect(dotless.warning).toMatchObject({ code: 'media-extension-rejected', ext: '' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects media when magic bytes do not match the extension', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-magic-'))
    try {
      const mediaIndex = { files: new Map([['ppt/media/video1.mp4', mockEntry(Buffer.from('not an mp4'))]]) }
      const result = await persistMediaBlob(mediaIndex, 'ppt/media/video1.mp4', dir)
      expect(result.url).toBeNull()
      expect(result.warning).toMatchObject({ code: 'media-magic-mismatch', claimed: 'mp4' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('allows mp4 magic bytes and writes uuid filename instead of hash filename', async () => {
    await withHashFileRestored(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-mp4-'))
      try {
        const mediaIndex = { files: new Map([['ppt/media/video1.mp4', mockEntry(validMp4)]]) }
        const result = await persistMediaBlob(mediaIndex, 'ppt/media/video1.mp4', dir)
        const filename = path.basename(result.url)
        expect(result.url).toMatch(/^\/uploads\/.+\.mp4$/)
        expect(filename).not.toBe(`${sha256(validMp4)}.mp4`)
        expect(await fs.readFile(path.join(dir, filename))).toEqual(validMp4)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  it.each([
    ['mp3', validMp3],
    ['wav', validWav],
    ['ogg', validOgg],
    ['webm', validWebm],
  ])('allows %s magic bytes through', async (ext, buffer) => {
    await withHashFileRestored(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), `pptx-media-${ext}-`))
      try {
        await fs.mkdir(path.dirname(HASHES_FILE), { recursive: true })
        await fs.writeFile(HASHES_FILE, '{}')
        const ref = `ppt/media/sample.${ext}`
        const mediaIndex = { files: new Map([[ref, mockEntry(buffer)]]) }
        const result = await persistMediaBlob(mediaIndex, ref, dir)
        expect(result.url).toMatch(new RegExp(`^/uploads/.+\\.${ext}$`))
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  it('serializes concurrent identical media writes through the hash index', async () => {
    await withHashFileRestored(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-race-'))
      try {
        await fs.mkdir(path.dirname(HASHES_FILE), { recursive: true })
        await fs.writeFile(HASHES_FILE, '{}')
        const mediaIndex = { files: new Map([['ppt/media/video1.mp4', mockEntry(validMp4)]]) }
        const results = await Promise.all([
          persistMediaBlob(mediaIndex, 'ppt/media/video1.mp4', dir),
          persistMediaBlob(mediaIndex, 'ppt/media/video1.mp4', dir),
        ])
        expect(results[0].url).toBe(results[1].url)
        expect(await fs.readdir(dir)).toHaveLength(1)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  it('removes a newly written media file if cancellation arrives before hash indexing', async () => {
    await withHashFileRestored(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-abort-cleanup-'))
      let checks = 0
      const signal = {
        throwIfAborted() {
          checks += 1
          if (checks >= 4) throw new DOMException('The operation was aborted', 'AbortError')
        },
      }
      try {
        await fs.mkdir(path.dirname(HASHES_FILE), { recursive: true })
        await fs.writeFile(HASHES_FILE, '{}')
        await expect(
          persistDedupedBuffer(validMp4, 'mp4', dir, { signal, mimeType: 'video/mp4' })
        ).rejects.toThrow('aborted')
        expect(await fs.readdir(dir)).toHaveLength(0)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  it('rolls back the hash entry and media file if cancellation arrives after hash indexing', async () => {
    await withHashFileRestored(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-abort-hash-rollback-'))
      let checks = 0
      const signal = {
        throwIfAborted() {
          checks += 1
          if (checks >= 5) throw new DOMException('The operation was aborted', 'AbortError')
        },
      }
      try {
        await fs.mkdir(path.dirname(HASHES_FILE), { recursive: true })
        await fs.writeFile(HASHES_FILE, '{}')
        await expect(
          persistDedupedBuffer(validMp4, 'mp4', dir, { signal, mimeType: 'video/mp4' })
        ).rejects.toThrow('aborted')
        expect(await fs.readdir(dir)).toHaveLength(0)
        expect(JSON.parse(await fs.readFile(HASHES_FILE, 'utf-8'))).toEqual({})
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })
})
