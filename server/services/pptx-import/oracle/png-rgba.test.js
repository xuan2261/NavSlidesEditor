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

describe('png-rgba', () => {
  it('roundtrips RGBA encode/decode', () => {
    const rgba = solid(4, 3, [10, 20, 30, 255])
    const png = encodePngRgba(4, 3, rgba)
    const decoded = decodePng(png)
    expect(decoded.width).toBe(4)
    expect(decoded.height).toBe(3)
    expect(decoded.data.equals(rgba)).toBe(true)
  })

  it('decoded identical PNGs score SSIM 1', () => {
    const rgba = solid(8, 8, [40, 80, 120, 255])
    const png = encodePngRgba(8, 8, rgba)
    const a = decodePng(png)
    const b = decodePng(png)
    expect(computeSsim(a.data, b.data, { width: 8, height: 8 })).toBeGreaterThanOrEqual(0.999)
  })

  it('rejects oversized dimensions', () => {
    const rgba = solid(4, 4, [1, 2, 3, 255])
    const png = encodePngRgba(4, 4, rgba)
    expect(() => decodePng(png, { maxDim: 2 })).toThrow(/exceed max/i)
  })
})

