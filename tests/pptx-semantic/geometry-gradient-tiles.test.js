import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { sampleGradientSvg } from './geometry-gradient-svg-sampler.js'
const require = createRequire(import.meta.url)
const { gradientSvgDefinition } = require('../../shared/src/pptx-geometry-gradient')
const sourceStops = [
  { pos: 0, color: { kind: 'srgb', value: 'F01E3C' } },
  { pos: 100000, color: { kind: 'srgb', value: '1E50F0' } },
]
const tile = { l: 25000, t: 25000, r: 25000, b: 25000 }
function svgFor(focus, stops = sourceStops, width = 180, height = 120) {
  return gradientSvgDefinition(
    {
      width,
      height,
      style: {
        fill: {
          gradient: {
            kind: 'path',
            path: 'circle',
            rotWithShape: true,
            fillToRect: focus,
            stops,
            tileRect: tile,
          },
        },
      },
    },
    { width, height, nativeStroke: false }
  )
}
const attributes = (tag) =>
  Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => match.slice(1)))

// Exact 6x native centers inside the tile cell, not repeat-boundary samples.
it.each([
  [
    [45.25, 30.25],
    [212, 48, 134],
  ],
  [
    [54.083333333333336, 54.083333333333336],
    [179, 60, 176],
  ],
  [
    [90.25, 60.25],
    [127, 72, 213],
  ],
])('retains the source focus center when tiling at %j', (point, native) => {
  const focus = { l: 0, t: 0, r: 100000, b: 100000 }
  const before = structuredClone({ focus, tile })
  const [actual] = sampleGradientSvg(svgFor(focus), [point])
  actual.forEach((channel, index) =>
    expect(Math.abs(channel - native[index])).toBeLessThanOrEqual(2)
  )
  expect({ focus, tile }).toEqual(before)
})

it('keeps source focal axes independent of the smaller outer tile', () => {
  const radius = Math.hypot(180, 120) / 2
  const svg = svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 })
  const focus = attributes([...svg.matchAll(/<path\b[^>]*>/g)].at(-1)[0])
  const [, rx, ry] = focus.d.match(/A([\d.e+-]+) ([\d.e+-]+)/)
  expect(Number(rx)).toBeCloseTo(radius * 0.6, 10)
  expect(Number(ry)).toBeCloseTo(radius * 0.2, 10)
})

it('does not clip a larger uniform source focus to the outer tile disk', () => {
  const radius = Math.hypot(180, 120) / 2
  const svg = svgFor({ l: 20000, r: 20000, t: 20000, b: 20000 })
  const focus = attributes([...svg.matchAll(/<path\b[^>]*>/g)].at(-1)[0])
  const [, rx, ry] = focus.d.match(/A([\d.e+-]+) ([\d.e+-]+)/)
  expect(Number(rx)).toBeCloseTo(radius * 0.6, 10)
  expect(Number(ry)).toBeCloseTo(radius * 0.6, 10)
  expect(focus.fill.match(/[\d.]+/g).map(Number)).toEqual([240, 30, 60])
})

it('retains the first stop across a saturated offset uniform focus', () => {
  const focus = { l: 10000, r: 30000, t: 10000, b: 30000 }
  // Opaque interiors agree on native-slide-{1,2}-2x overlap white/black pairs.
  const witnesses = [
    [150.25, 60.25],
    [140.75, 42.25],
    [147.25, 42.75],
    // The native fan also covers these points outside all level-set disks.
    [150.25, 90.25],
    [160.25, 100.25],
    [170.25, 110.25],
  ]
  const before = structuredClone({ focus, tile, sourceStops })
  const samples = sampleGradientSvg(svgFor(focus), witnesses)
  expect(samples).toEqual(witnesses.map(() => [240, 30, 60]))
  expect({ focus, tile, sourceStops }).toEqual(before)
})

it('renders reflected cell boundaries and nonnested fan overlap at native centers', () => {
  const focus = { l: 0, t: 0, r: 100000, b: 100000 }
  // Same exact centers in the unchanged 6x PowerPoint white/black pair.
  const witnesses = [
    [0.25, 0.25, [158, 66, 194]],
    [4.25, 0.25, [169, 63, 185]],
    [20.25, 0.25, [203, 52, 147]],
    [45.25, 0.25, [213, 48, 132]],
    [60.25, 0.25, [186, 58, 168]],
    [90.25, 0.25, [102, 75, 224]],
    [36 + 1 / 12, 21 + 1 / 12, [96, 76, 226]],
  ]
  const before = structuredClone({ focus, tile, sourceStops })
  const samples = sampleGradientSvg(
    svgFor(focus),
    witnesses.map(([x, y]) => [x, y])
  )
  witnesses.forEach(([, , expected], index) =>
    expected.forEach((channel, component) =>
      expect.soft(Math.abs(samples[index][component] - channel)).toBeLessThanOrEqual(2)
    )
  )
  expect({ focus, tile, sourceStops }).toEqual(before)
})

it('uses the later boundary angle in concentric nonuniform exit lobes', () => {
  const focus = { l: 20000, r: 20000, t: 40000, b: 40000 }
  // Exact centers in native-slide-{3,4}-6x-ellipse-overlap.png.
  // Both unchanged PowerPoint backgrounds give the same opaque RGB.
  const witnesses = [
    [145.25, 44.25, [77, 77, 232]],
    [144.75, 45.25, [82, 77, 231]],
    [33.75, 75.75, [38, 80, 239]],
    [34.25, 75.25, [51, 79, 238]],
  ]
  const before = structuredClone({ focus, tile, sourceStops })
  const samples = sampleGradientSvg(
    svgFor(focus),
    witnesses.map(([x, y]) => [x, y])
  )
  witnesses.forEach(([, , expected], index) =>
    expected.forEach((channel, component) =>
      expect.soft(Math.abs(samples[index][component] - channel)).toBeLessThanOrEqual(2)
    )
  )
  expect({ focus, tile, sourceStops }).toEqual(before)
})

it('keeps the earlier boundary angle in the opposite nonuniform lobes', () => {
  const samples = sampleGradientSvg(svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 }), [
    [145.25, 75.75],
    [34.25, 44.75],
  ])
  // These native controls remain on the red entry branch, not the blue exit.
  for (const color of samples) expect(color[0]).toBeGreaterThan(color[2])
})

it('keeps the source focus color where the focus extends outside the outer circle', () => {
  const samples = sampleGradientSvg(svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 }), [
    [144.25, 50.25],
    [35.75, 69.75],
  ])
  expect(samples).toEqual([
    [240, 30, 60],
    [240, 30, 60],
  ])
})

it('retains the right-hand color of a hard stop on the exit branch', () => {
  const stops = [
    { pos: 0, color: { kind: 'srgb', value: 'FF0000' } },
    { pos: 50000, color: { kind: 'srgb', value: 'FF0000' } },
    { pos: 50000, color: { kind: 'srgb', value: '0000FF' } },
    { pos: 100000, color: { kind: 'srgb', value: '0000FF' } },
  ]
  const samples = sampleGradientSvg(svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 }, stops), [
    [145.25, 44.25],
    [34.25, 75.25],
  ])
  expect(samples).toEqual([
    [0, 0, 255],
    [0, 0, 255],
  ])
})

it.each([
  [181, 120],
  [1920, 1080],
])(
  'keeps concentric branch selection independent of extent rounding at %j x %j',
  (width, height) => {
    const focus = { l: 20000, r: 20000, t: 40000, b: 40000 }
    const ratio = Math.hypot(width, height) / Math.hypot(180, 120)
    const point = [width / 2 + 55.25 * ratio, height / 2 - 15.75 * ratio]
    const expected = sampleGradientSvg(svgFor(focus), [[145.25, 44.25]])
    const actual = sampleGradientSvg(svgFor(focus, sourceStops, width, height), [point])
    expect(actual).toEqual(expected)
  }
)
