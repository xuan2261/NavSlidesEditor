import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import media from './media.js'

const { persistImageBuffer } = media

describe('pptx media persistence', () => {
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
