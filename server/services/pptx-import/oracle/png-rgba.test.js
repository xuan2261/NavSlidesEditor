import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodePngRgba, decodePng } from './png-rgba.js'
import { computeSsim } from './ssim.js'

function solid(w, h, rgba) {
  const buf = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    buf[i * 4] = rgba[0]
    buf[i * 4 + 1] = rgba[1]
    buf[i * 4 + 2] = rgba[2]
    buf[i * 4 + 3] = rgba[3]
  }
  return buf
}

function fixturePixels(mode) {
  const rgba = Buffer.alloc(3 * 3 * 4)
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const offset = (y * 3 + x) * 4
      rgba[offset] = (31 * x + 17 * y) % 256
      rgba[offset + 1] = (13 * x + 29 * y) % 256
      rgba[offset + 2] = (47 * x + 7 * y) % 256
      rgba[offset + 3] = mode === 'rgb' ? 255 : (255 - 19 * x - 11 * y) % 256
    }
  }
  return rgba
}

describe('png-rgba', () => {
  it('roundtrips RGBA encode/decode', () => {
    const rgba = solid(4, 3, [10, 20, 30, 255])
    const png = encodePngRgba(4, 3, rgba)
    const decoded = decodePng(png)
    expect(decoded.width).toBe(4)
    expect(decoded.height).toBe(3)
    expect(decoded.data.equals(rgba)).toBe(true)
  })

  it.each(['rgb', 'rgba'])('decodes fixed %s fixtures for PNG filters 1 through 4', (mode) => {
    for (const filterType of [1, 2, 3, 4]) {
      const png = readFileSync(path.join(
        process.cwd(), 'server', 'services', 'pptx-import', 'oracle', 'fixtures', 'png-filters', `${mode}-filter-${filterType}.png`
      ))
      const decoded = decodePng(png)
      expect(decoded).toMatchObject({ width: 3, height: 3 })
      expect(decoded.data.equals(fixturePixels(mode))).toBe(true)
    }
  })

  it('decoded identical PNGs score SSIM 1', () => {
    const rgba = solid(8, 8, [40, 80, 120, 255])
    const png = encodePngRgba(8, 8, rgba)
    const a = decodePng(png)
    const b = decodePng(png)
    expect(computeSsim(a.data, b.data, { width: 8, height: 8 })).toBeGreaterThanOrEqual(0.999)
  })

  it('rejects a truncated PNG chunk before attempting image comparison', () => {
    const png = encodePngRgba(4, 4, solid(4, 4, [1, 2, 3, 255]))
    expect(() => decodePng(png.subarray(0, -1))).toThrow(/truncated|IEND/i)
  })

  it('rejects oversized dimensions', () => {
    const rgba = solid(4, 4, [1, 2, 3, 255])
    const png = encodePngRgba(4, 4, rgba)
    expect(() => decodePng(png, { maxDim: 2 })).toThrow(/exceed max/i)
  })
})

