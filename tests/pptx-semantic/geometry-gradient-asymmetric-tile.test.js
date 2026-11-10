import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { sampleGradientSvg } from './geometry-gradient-svg-sampler.js'
const require = createRequire(import.meta.url)
const { gradientSvgDefinition } = require('../../shared/src/pptx-geometry-gradient')

function source(focus, tile) {
  return {
    width: 180,
    height: 120,
    style: {
      fill: {
        gradient: {
          kind: 'path',
          path: 'circle',
          rotWithShape: true,
          fillToRect: focus,
          tileRect: tile,
          stops: [
            { pos: 0, color: { kind: 'srgb', value: 'F01E3C' } },
            { pos: 100000, color: { kind: 'srgb', value: '1E50F0' } },
          ],
        },
      },
    },
  }
}
const svgFor = (geometry) =>
  gradientSvgDefinition(geometry, { width: 180, height: 120, nativeStroke: false })

// Exact opaque pixel centers agree on unchanged native-slide-{3,4}-2x.png.
it.each([
  [
    { l: 20000, r: 20000, t: 40000, b: 40000 },
    { l: 20000, t: 25000, r: 25000, b: 25000 },
    [100.25, 91.25],
    [225, 41, 109],
  ],
  [
    { l: 40000, r: 40000, t: 20000, b: 20000 },
    { l: 25000, t: 20000, r: 25000, b: 25000 },
    [65.25, 106.25],
    [111, 74, 220],
  ],
  [
    { l: 40000, r: 40000, t: 20000, b: 20000 },
    { l: 25000, t: 20000, r: 25000, b: 25000 },
    [108.25, 7.25],
    [182, 59, 172],
  ],
])('retains native focus-axis proportions for %j', (focus, tile, point, native) => {
  const geometry = source(focus, tile),
    before = structuredClone(geometry),
    [actual] = sampleGradientSvg(svgFor(geometry), [point])
  native.forEach((channel, index) =>
    expect.soft(Math.abs(actual[index] - channel)).toBeLessThanOrEqual(2)
  )
  expect(geometry).toEqual(before)
})

it('uses an ellipse when asymmetric tiling changes equal source focus axes', () => {
  const svg = svgFor(
    source({ l: 40000, r: 40000, t: 40000, b: 40000 }, { l: 20000, t: 25000, r: 25000, b: 25000 })
  )
  expect(svg).not.toContain('<radialGradient')
  const focus = [...svg.matchAll(/<path\b[^>]*>/g)].at(-1)?.[0]
  expect(focus).toBeDefined()
  const radius = Math.hypot(180 * 0.55, 120 * 0.5) / 2
  const [, rx, ry] = focus.match(/A([\d.e+-]+) ([\d.e+-]+)/)
  expect(Number(rx)).toBeCloseTo((radius * 0.2) / 0.55, 10)
  expect(Number(ry)).toBeCloseTo((radius * 0.2) / 0.5, 10)
})

it.each([
  [180, 120],
  [181, 120],
  [1920, 1080],
])('retains equal native rational focus scales at %ix%i', (width, height) => {
  const geometry = source(
    { l: 40000, r: 40000, t: 39000, b: 39000 },
    { l: 25000, r: 25000, t: 20000, b: 25000 }
  )
  geometry.width = width
  geometry.height = height
  const svg = svgFor(geometry)
  expect(svg).toContain('<radialGradient')
  const radial = svg.match(/<radialGradient[^>]+>/)[0]
  const radius = Number(radial.match(/ r="([^"]+)"/)[1])
  expect(Number(radial.match(/ fr="([^"]+)"/)[1])).toBe(radius * 0.4)
})
