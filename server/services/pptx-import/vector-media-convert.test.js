import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { convertEmfWmfBuffer } from './vector-media-convert.js'
import { persistImageBuffer } from './media.js'
import { encodePngRgba } from './oracle/png-rgba.js'

const EMF = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00])

function solidPng() {
  const rgba = Buffer.alloc(4 * 4 * 4, 200)
  for (let i = 0; i < 16; i += 1) rgba[i * 4 + 3] = 255
  return encodePngRgba(4, 4, rgba)
}

describe('vector-media-convert (T7.1 T7.5 T7.6)', () => {
  /** @type {string[]} */
  const temps = []
  afterEach(async () => {
    await Promise.all(temps.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })))
  })

  it('T7.1 sniff path: mock convert returns PNG buffer', async () => {
    const png = solidPng()
    const result = await convertEmfWmfBuffer(EMF, {
      force: true,
      convertFn: (input, output) => {
        require('fs').writeFileSync(output, png)
        return { ok: true, outPath: output }
      },
    })
    expect(result.ok).toBe(true)
    expect(result.mime).toBe('image/png')
    expect(result.buffer.equals(png)).toBe(true)
  })

  it('T7.5 dedup: same EMF converts to same uploads url hash path', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'emf-dedup-'))
    temps.push(dir)
    const png = solidPng()
    const convertFn = (input, output) => {
      require('fs').writeFileSync(output, png)
      return { ok: true, outPath: output }
    }
    // Mirrors the mapper's convert-then-persist composition, so the dedup
    // guarantee is checked on the path the import pipeline actually runs.
    const persistConverted = async () => {
      const converted = await convertEmfWmfBuffer(EMF, { force: true, convertFn })
      expect(converted.ok).toBe(true)
      return persistImageBuffer(converted.buffer, 'image/png', dir)
    }
    const a = await persistConverted()
    const b = await persistConverted()
    expect(a.url).toBeTruthy()
    expect(a.url).toBe(b.url)
  })

  it('T7.6 convertFn failure surfaces code', async () => {
    const result = await convertEmfWmfBuffer(EMF, {
      force: true,
      convertFn: () => ({ ok: false, error: 'timeout', code: 'CONVERT_FAILED' }),
    })
    expect(result.ok).toBe(false)
    expect(result.code).toBe('CONVERT_FAILED')
  })

  it('disabled convert without force returns DISABLED', async () => {
    const prev = process.env.PPTX_EMF_CONVERT
    delete process.env.PPTX_EMF_CONVERT
    try {
      const result = await convertEmfWmfBuffer(EMF)
      expect(result.ok).toBe(false)
      expect(result.code).toBe('DISABLED')
    } finally {
      if (prev != null) process.env.PPTX_EMF_CONVERT = prev
    }
  })
})
