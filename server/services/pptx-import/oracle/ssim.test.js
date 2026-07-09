import { describe, expect, it } from 'vitest'
import ssimMod from './ssim.js'

const { computeSsim, roundSsim } = ssimMod

function solid(w, h, rgba) {
  const buf = Buffer.alloc(w * h * 4)
  for (let i = 0; i < w * h; i += 1) {
    buf[i * 4] = rgba[0]
    buf[i * 4 + 1] = rgba[1]
    buf[i * 4 + 2] = rgba[2]
    buf[i * 4 + 3] = rgba[3] ?? 255
  }
  return buf
}

describe('oracle ssim (T2.1 T2.2)', () => {
  it('T2.1 identical buffers → SSIM === 1 (or ≥ 0.999)', () => {
    const a = solid(32, 24, [40, 80, 120, 255])
    const b = Buffer.from(a)
    expect(computeSsim(a, b, { width: 32, height: 24 })).toBeGreaterThanOrEqual(0.999)
    expect(roundSsim(computeSsim(a, b, { width: 32, height: 24 }))).toBe(1)
  })

  it('T2.2 black vs white is below low bound', () => {
    const black = solid(16, 16, [0, 0, 0, 255])
    const white = solid(16, 16, [255, 255, 255, 255])
    const score = computeSsim(black, white, { width: 16, height: 16 })
    expect(score).toBeLessThan(0.2)
  })

  it('throws on size mismatch', () => {
    expect(() => computeSsim(Buffer.alloc(4), Buffer.alloc(8), { width: 1, height: 1 })).toThrow()
  })
})
