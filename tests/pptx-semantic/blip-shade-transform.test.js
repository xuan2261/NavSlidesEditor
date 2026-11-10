import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {
  blipShadeColorTransform,
  BLIP_SHADE_MODIFIERS,
} = require('../../shared/src/pptx-geometry-blip-shade.js')

describe('blip path shade discrete color transform', () => {
  it('exports canonical supported modifiers', () => {
    expect(BLIP_SHADE_MODIFIERS).toEqual(['lighten', 'lightenLess', 'darken', 'darkenLess'])
  })

  it('preserves alpha identically for all modifiers and all alpha levels', () => {
    for (const modifier of BLIP_SHADE_MODIFIERS) {
      for (const alpha of [0, 1, 64, 128, 200, 255]) {
        const [, , , a] = blipShadeColorTransform([100, 150, 200, alpha], modifier)
        expect(a).toBe(alpha)
      }
    }
  })

  it('matches frozen integer transfer table for norm (identity)', () => {
    const input = [100, 150, 200, 255]
    expect(blipShadeColorTransform(input, 'norm')).toEqual(input)
  })

  it('matches frozen integer transfer table for constant-rgb case across all modes', () => {
    // Frozen control pixels from blip-path-shade.pptx:
    // norm: [100, 150, 200, 255]
    // lighten: [162, 192, 222, 255]
    // lightenLess: [130, 171, 211, 255]
    // darken: [60, 90, 120, 255]
    // darkenLess: [80, 121, 161, 255]
    const norm = [100, 150, 200, 255]
    expect(blipShadeColorTransform(norm, 'lighten')).toEqual([162, 192, 222, 255])
    expect(blipShadeColorTransform(norm, 'lightenLess')).toEqual([130, 171, 211, 255])
    expect(blipShadeColorTransform(norm, 'darken')).toEqual([60, 90, 120, 255])
    expect(blipShadeColorTransform(norm, 'darkenLess')).toEqual([80, 121, 161, 255])
  })

  it('matches frozen integer transfer table for constant-white case across all modes', () => {
    // norm: [255, 255, 255, 255]
    // lighten: [255, 255, 255, 255]
    // lightenLess: [255, 255, 255, 255]
    // darken: [153, 153, 153, 255]
    // darkenLess: [205, 205, 205, 255]
    const white = [255, 255, 255, 255]
    expect(blipShadeColorTransform(white, 'lighten')).toEqual([255, 255, 255, 255])
    expect(blipShadeColorTransform(white, 'lightenLess')).toEqual([255, 255, 255, 255])
    expect(blipShadeColorTransform(white, 'darken')).toEqual([153, 153, 153, 255])
    expect(blipShadeColorTransform(white, 'darkenLess')).toEqual([205, 205, 205, 255])
  })

  it('matches frozen integer transfer table for black [0, 0, 0, 255] across all modes', () => {
    // Frozen control pixels from blip-path-shade.pptx (horizontal-opaque pixel 0):
    // norm: [0, 0, 0, 255]
    // lighten: [102, 102, 102, 255] (mix = trunc(255 * 0.4) = 102)
    // lightenLess: [50, 50, 50, 255] (mix = trunc(255 * (1 - 0.8)) = trunc(50.99999999999999) = 50)
    // darken: [0, 0, 0, 255]
    // darkenLess: [0, 0, 0, 255]
    const black = [0, 0, 0, 255]
    expect(blipShadeColorTransform(black, 'lighten')).toEqual([102, 102, 102, 255])
    expect(blipShadeColorTransform(black, 'lightenLess')).toEqual([50, 50, 50, 255])
    expect(blipShadeColorTransform(black, 'darken')).toEqual([0, 0, 0, 255])
    expect(blipShadeColorTransform(black, 'darkenLess')).toEqual([0, 0, 0, 255])
  })

  it('rejects unsupported modifier', () => {
    expect(() => blipShadeColorTransform([100, 150, 200, 255], 'invert')).toThrow(TypeError)
  })

  it('rejects invalid RGBA input', () => {
    expect(() => blipShadeColorTransform([100, 150], 'lighten')).toThrow(TypeError)
    expect(() => blipShadeColorTransform([100, 150, 200, 300], 'lighten')).toThrow(TypeError)
  })
})
