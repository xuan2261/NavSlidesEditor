import { createRequire } from 'node:module'
import { beforeAll, expect, it } from 'vitest'
import {
  sampleGradientSvg,
  sampleGradientSvgOnBackgrounds,
} from './geometry-gradient-svg-sampler.js'
const require = createRequire(import.meta.url)
const { gradientSvgDefinition } = require('../../shared/src/pptx-geometry-gradient')

function source() {
  const gradient = {
    kind: 'path',
    path: 'circle',
    rotWithShape: true,
    fillToRect: { l: 10000, r: 30000, t: 40000, b: 40000 },
    tileRect: { l: 25000, t: 25000, r: 25000, b: 25000 },
    stops: [
      { pos: 0, color: { kind: 'srgb', value: 'F01E3C' } },
      { pos: 100000, color: { kind: 'srgb', value: '1E50F0' } },
    ],
  }
  return { width: 180, height: 120, style: { fill: { gradient } } }
}
function svgFor(geometry = source()) {
  const before = structuredClone(geometry)
  const svg = gradientSvgDefinition(geometry, {
    width: geometry.width,
    height: geometry.height,
    nativeStroke: false,
  })
  expect(geometry).toEqual(before)
  expect(JSON.parse(JSON.stringify(geometry))).toEqual(before)
  expect(svg).not.toMatch(/NaN|Infinity|<image\b/)
  return svg
}
let sourceSvg
beforeAll(() => {
  sourceSvg = svgFor()
})

// Unchanged overlap source SHA 0825a674ebc406b91028f9015a97c76d178bfe2b2e7a1d79af3c76786b2a8531.
// Exact 2x pixel centers, circle-offset-wide-tile, native-slide-{1,2}-2x.png.
// Both backgrounds agree: these are opaque branch/hull witnesses, not fitted colors.
it.each([
  ['larger root at the later angle', [32.25, 80.75], [37, 80, 239]],
  ['smaller root at the later angle', [35.75, 41.75], [239, 31, 63]],
  ['lower no-root focal hull', [143.75, 67.75], [240, 30, 60]],
  ['upper no-root focal hull', [143.75, 52.25], [240, 30, 60]],
  ['focal hull priority over a gradient root', [140.25, 52.25], [240, 30, 60]],
])('renders %s at the native center', (_name, point, native) => {
  const [actual] = sampleGradientSvg(sourceSvg, [point])
  expect(actual).toBeDefined()
  native.forEach((channel, index) =>
    expect.soft(Math.abs(actual[index] - channel)).toBeLessThanOrEqual(2)
  )
})

it('leaves the outer fan hull transparent outside actual support', () => {
  // Native white [255,255,255], black [0,0,0]; no boundary root and outside H0.
  expect(sampleGradientSvg(sourceSvg, [[143.75, 80.25]])[0]).toBeUndefined()
})
function boundaryPoint(t, angle) {
  const radius = Math.hypot(90, 60) / 2
  return [
    72 + 18 * t + radius * (1.2 - 0.2 * t) * Math.cos(angle),
    60 + radius * (0.4 + 0.6 * t) * Math.sin(angle),
  ]
}
function hardStops(offset, beforeAlpha = 100000, afterAlpha = 100000) {
  return [
    [0, 'FF0000', beforeAlpha],
    [offset, 'FF0000', beforeAlpha],
    [offset, '0000FF', afterAlpha],
    [100000, '0000FF', afterAlpha],
  ].map(([pos, value, alpha]) => ({
    pos,
    color: { kind: 'srgb', value, transforms: [{ kind: 'alpha', value: alpha }] },
  }))
}

// Manufactured exact ellipse-boundary witnesses, not additional native evidence.
// These select the first root in the upper half and last root in the lower half.
it.each([
  [10000, 4.1],
  [90000, 2.7],
])('retains both exact hard-stop sides at source offset %i', (offset, angle) => {
  const geometry = source()
  geometry.style.fill.gradient.stops = hardStops(offset)
  const points = [-1, 1].map((side) => boundaryPoint(offset / 100000 + side * 1e-5, angle))
  expect(sampleGradientSvg(svgFor(geometry), points)).toEqual([
    [255, 0, 0],
    [0, 0, 255],
  ])
})

it.each([
  [100000, 0],
  [0, 100000],
])('replaces branch alpha across a hard stop from %i to %i', (beforeAlpha, afterAlpha) => {
  const geometry = source()
  geometry.style.fill.gradient.stops = hardStops(90000, beforeAlpha, afterAlpha)
  const points = [-1, 1].map((side) => boundaryPoint(0.9 + side * 1e-5, 2.7))
  for (const background of [
    [255, 255, 255],
    [0, 0, 0],
  ]) {
    expect(sampleGradientSvg(svgFor(geometry), points, { background })).toEqual([
      beforeAlpha ? [255, 0, 0] : background,
      afterAlpha ? [0, 0, 255] : background,
    ])
  }
})

it('applies constant alpha once across the focal hull and overlapping branches', () => {
  const geometry = source()
  geometry.style.fill.gradient.stops = [0, 100000].map((pos) => ({
    pos,
    color: { kind: 'srgb', value: 'F01E3C', transforms: [{ kind: 'alpha', value: 50000 }] },
  }))
  const points = [
    [32.25, 80.75],
    [143.75, 67.75],
    [140.25, 52.25],
  ]
  for (const background of [
    [255, 255, 255],
    [0, 0, 0],
  ]) {
    const expected = [240, 30, 60].map((v, i) => (v * 128 + background[i] * 127) / 255)
    for (const actual of sampleGradientSvg(svgFor(geometry), points, { background }))
      actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 10))
  }
})

it('preserves premultiplied fading on the later overlapping branch', () => {
  const geometry = source()
  geometry.style.fill.gradient.stops = [0, 100000].map((pos) => ({
    pos,
    color: { kind: 'srgb', value: 'F01E3C', transforms: [{ kind: 'alpha', value: 100000 - pos }] },
  }))
  const backgrounds = [
    [255, 255, 255],
    [0, 0, 0],
  ]
  const samples = sampleGradientSvgOnBackgrounds(svgFor(geometry), [[32.25, 80.75]], backgrounds)
  for (const [index, background] of backgrounds.entries()) {
    const [actual] = samples[index]
    const t = 0.979189
    actual.forEach((value, i) =>
      expect(
        Math.abs(value - ([240, 30, 60][i] * (1 - t) + background[i] * t))
      ).toBeLessThanOrEqual(2)
    )
  }
})

it.each([2, 8])('keeps source branch and hull paint invariant at extent factor %i', (factor) => {
  const geometry = source(),
    points = [
      [32.25, 80.75],
      [35.75, 41.75],
      [143.75, 67.75],
      [143.75, 80.25],
    ]
  const expected = sampleGradientSvg(sourceSvg, points)
  geometry.width *= factor
  geometry.height *= factor
  expect(
    sampleGradientSvg(
      svgFor(geometry),
      points.map((p) => p.map((v) => v * factor))
    )
  ).toEqual(expected)
})
it('reflects the corrected vector field without changing its branch choice', () => {
  const radius = Math.hypot(90, 60) / 2,
    x = 90 - radius,
    y = 60 - radius
  const point = [40, 81],
    svg = sourceSvg
  const [expected] = sampleGradientSvg(svg, [point])
  expect(
    sampleGradientSvg(svg, [
      [2 * x - point[0], point[1]],
      [point[0], 2 * y - point[1]],
      [point[0] + 4 * radius, point[1] + 4 * radius],
    ])
  ).toEqual([expected, expected, expected])
})

it.each([
  // Independent boundary-equation roots (t,theta): (.135156,4.105439), (.568586,3.866325).
  [
    [38.25, 28.25],
    [255, 0, 0],
  ],
  // (.315817,2.267096), (.992250,2.833130). Both axes now have displaced centers.
  [
    [38.25, 76.25],
    [0, 0, 255],
  ],
])('orders roots across moving ellipse half-planes at %j', (point, expected) => {
  const geometry = source()
  geometry.style.fill.gradient.fillToRect = { l: 10000, r: 30000, t: 30000, b: 50000 }
  geometry.style.fill.gradient.stops = hardStops(50000)
  expect(sampleGradientSvg(svgFor(geometry), [point])).toEqual([expected])
})
