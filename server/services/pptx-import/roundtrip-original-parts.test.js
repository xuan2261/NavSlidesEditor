import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { persistOriginalPptx } from './original-package.js'
import { resolvePptxExportPayload, markPresentationEdited } from './roundtrip-original-parts.js'

describe('roundtrip-original-parts (T8.4)', () => {
  /** @type {string[]} */
  const temps = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })))
  })

  it('T8.4 unedited deck with original returns original-bytes buffer', async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-orig-'))
    temps.push(baseDir)
    const buf = Buffer.from('PK-fake-pptx-bytes')
    const artifact = await persistOriginalPptx(buf, { baseDir })
    // Point original package at temp baseDir by writing via real API needs DATA_DIR —
    // use persist with default DATA_DIR in integration; here mock read by using real store under DATA_DIR
    // For unit: call resolve with inject — instead re-persist under default data if needed.
    // Simpler: use persistOriginalPptx without baseDir (real data dir) then cleanup delete
    const { deleteOriginalPptx } = require('./original-package.js')
    const art = await persistOriginalPptx(buf)
    try {
      const pres = {
        id: 'p1',
        pptxOriginal: {
          id: art.id,
          sha256: art.sha256,
          byteLength: art.byteLength,
          uploadedAt: art.uploadedAt,
        },
      }
      const payload = await resolvePptxExportPayload(pres)
      expect(payload.mode).toBe('original-bytes')
      expect(payload.buffer.equals(buf)).toBe(true)
      expect(payload.sha256).toBe(crypto.createHash('sha256').update(buf).digest('hex'))
    } finally {
      await deleteOriginalPptx(art.id)
    }
  })

  it('T8.5 edited presentation falls back to hybrid-export', async () => {
    const art = await persistOriginalPptx(Buffer.from('x'))
    try {
      const pres = markPresentationEdited({
        pptxOriginal: { id: art.id, sha256: art.sha256 },
      })
      const payload = await resolvePptxExportPayload(pres)
      expect(payload.mode).toBe('hybrid-export')
      expect(payload.reason).toMatch(/edited/)
    } finally {
      const { deleteOriginalPptx } = require('./original-package.js')
      await deleteOriginalPptx(art.id)
    }
  })
})
