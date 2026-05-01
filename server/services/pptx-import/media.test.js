import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import media from './media.js'

const { persistImageBuffer, persistMediaBlob, MAX_MEDIA_SIZE } = media

describe('pptx media persistence', () => {
  it('rejects files exceeding MAX_MEDIA_SIZE in persistImageBuffer', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-size-'))
    try {
      // Build a small PNG header (8-byte minimal PNG)
      const oversized = Buffer.alloc(MAX_MEDIA_SIZE + 1)
      const url = await persistImageBuffer(oversized, 'image/png', dir)
      expect(url).toBeNull()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('accepts files under MAX_MEDIA_SIZE in persistImageBuffer', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-ok-'))
    try {
      // Minimal 1x1 red PNG
      const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 15, 0, 0, 1, 1, 0, 5, 24, 212, 205, 0, 0, 0, 59, 73, 69, 78, 68, 174, 66, 96, 130])
      const url = await persistImageBuffer(validPng, 'image/png', dir)
      expect(url).toMatch(/^\/uploads\//)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects files exceeding MAX_MEDIA_SIZE in persistMediaBlob', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-blob-size-'))
    try {
      const mockEntry = { async: () => Promise.resolve(Buffer.alloc(MAX_MEDIA_SIZE + 1)) }
      const mediaIndex = { files: new Map([['ppt/media/oversized.mp4', mockEntry]]) }
      const url = await persistMediaBlob(mediaIndex, 'ppt/media/oversized.mp4', dir)
      expect(url).toBeNull()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  // ─── Existing test ───────────────────────────────────────────────────
  it('rejects non-image payloads', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-media-'))
    try {
      const url = await persistImageBuffer(Buffer.from('not an image'), 'text/plain', dir)
      expect(url).toBeNull()
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
