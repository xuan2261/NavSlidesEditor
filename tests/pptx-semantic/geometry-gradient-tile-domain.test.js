import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { sampleGradientSvg } from './geometry-gradient-svg-sampler.js'
const require = createRequire(import.meta.url)
const { gradientSvgDefinition } = require('../../shared/src/pptx-geometry-gradient')

function svgFor(tileRect, fillToRect = { l: 50000, r: 50000, t: 50000, b: 50000 }) {
  const geometry = {
    width: 180,
    height: 120,
    style: {
      fill: {
        gradient: {
          kind: 'path',
          path: 'circle',
          rotWithShape: true,
          fillToRect,
          tileRect,
          stops: [
            { pos: 0, color: { kind: 'srgb', value: 'F01E3C' } },
            { pos: 100000, color: { kind: 'srgb', value: '1E50F0' } },
          ],
        },
      },
    },
  }
  const before = structuredClone(geometry)
  const svg = gradientSvgDefinition(geometry, { width: 180, height: 120, nativeStroke: false })
  expect(geometry).toEqual(before)
  expect(svg).not.toMatch(/NaN|Infinity/)
  return svg
}

// PowerPoint 16/10417 domain source, opaque pixel centers on both backgrounds.
// Compare byte channels, as verified by Chromium getImageData, not pre-quantized floats.
it.each([
  [{ l: 50000, r: 50000, t: 25000, b: 25000 }, [20.25, 20.25], [101, 75, 225]],
  [{ l: 25000, r: 25000, t: 50000, b: 50000 }, [20.25, 20.25], [30, 80, 240]],
  [{ l: 60000, r: 60000, t: 25000, b: 25000 }, [20.25, 20.25], [66, 78, 235]],
  [{ l: 25000, r: 25000, t: 60000, b: 60000 }, [90.25, 60.25], [240, 30, 61]],
])('preserves native point focus for signed tile %j', (tile, point, native) => {
  const [actual] = sampleGradientSvg(svgFor(tile), [point])
  expect(actual).toBeDefined()
  native.forEach((channel, index) =>
    expect.soft(Math.abs(Math.round(actual[index]) - channel)).toBeLessThanOrEqual(2)
  )
})

// Isolated native Slide.Export crops match the point-focus pair byte-for-byte.
it('retains native default focus scales for a negative tile height', () => {
  const svg = svgFor(
    { l: 25000, r: 25000, t: 60000, b: 60000 },
    { l: 40000, r: 40000, t: 20000, b: 20000 }
  )
  const [actual] = sampleGradientSvg(svg, [[90.25, 60.25]])
  expect(actual).toBeDefined()
  ;[240, 30, 61].forEach((channel, index) =>
    expect.soft(Math.abs(Math.round(actual[index]) - channel)).toBeLessThanOrEqual(2)
  )
})

it.each([50000, 60000])('retains transparent support outside tile y=%i', (edge) => {
  const svg = svgFor({ l: 25000, r: 25000, t: edge, b: edge })
  expect(sampleGradientSvg(svg, [[150.25, 100.25]])[0]).toBeUndefined()
})

// Native finite-focus frames are byte-identical to the sealed point-focus pair.
it.each([
  [
    { l: 50000, r: 50000, t: 25000, b: 25000 },
    { l: 20000, r: 20000, t: 40000, b: 40000 },
    [101, 75, 225],
  ],
  [
    { l: 25000, r: 25000, t: 50000, b: 50000 },
    { l: 40000, r: 40000, t: 20000, b: 20000 },
    [30, 80, 240],
  ],
  [
    { l: 60000, r: 60000, t: 25000, b: 25000 },
    { l: 20000, r: 20000, t: 40000, b: 40000 },
    [66, 78, 235],
  ],
])('retains native default focus scales for nonpositive tile %j', (tile, focus, native) => {
  const [actual] = sampleGradientSvg(svgFor(tile, focus), [[20.25, 20.25]])
  expect(actual).toBeDefined()
  native.forEach((channel, index) =>
    expect.soft(Math.abs(Math.round(actual[index]) - channel)).toBeLessThanOrEqual(2)
  )
})
