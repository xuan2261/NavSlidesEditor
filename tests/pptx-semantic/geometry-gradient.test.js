import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture'
const require = createRequire(import.meta.url)
const {
  normalizeGeometryDocument,
  geometryStrokePaint,
} = require('../../shared/src/pptx-geometry-document')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { gradientPaintStops } = require('../../shared/src/pptx-geometry-gradient')

const gradient = {
  kind: 'linear',
  angle: 2700000,
  scaled: true,
  rotWithShape: true,
  stops: [
    { pos: 0, color: { kind: 'srgb', value: 'FF0000' } },
    { pos: 50000, color: { kind: 'srgb', value: '00FF00' } },
    { pos: 50000, color: { kind: 'srgb', value: '0000FF' } },
    { pos: 100000, color: { kind: 'srgb', value: '0000FF' } },
  ],
}
function documentWithGradient(value = gradient) {
  const initial = geometryProjectionFixture()
  const geometry = initial.pptxSemantic.definitions.definition.content.geometry
  return { ...geometry, style: { fill: { gradient: structuredClone(value) } } }
}
it('retains explicit stroke none without inventing an authored width', () => {
  const initial = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  const input = { ...initial, style: { stroke: { color: { kind: 'none' } } } }
  const normalized = normalizeGeometryDocument(input)
  expect(normalized.style.stroke).toEqual({ color: { kind: 'none' } })
  expect(Object.hasOwn(normalized.style.stroke, 'width')).toBe(false)
  expect(geometryStrokePaint(normalized)).toEqual({ stroke: 'none', strokeWidth: 0 })
})

it('retains exact ordered native linear gradient declarations and hard transitions', () => {
  const input = documentWithGradient()
  const before = structuredClone(input)
  expect(normalizeGeometryDocument(input).style.fill).toEqual({ gradient })
  expect(input).toEqual(before)
})

it('edits a native gradient through the canonical occurrence command and reopens without collateral changes', () => {
  const initial = geometryProjectionFixture()
  const before = structuredClone(initial)
  const changed = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-gradient', gradient },
  })
  expect(
    changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
  ).toEqual({ gradient })
  const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(changed)))
  expect(reopened.pptxSemantic).toEqual(changed.pptxSemantic)
  expect(changed.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(changed.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
  const html = renderSlideElements(changed.slides[0], { pptxSemantic: changed.pptxSemantic })
  const parsedStops = [...html.matchAll(/<stop\b[^>]*offset="([^"]+)"/g)].map((match) =>
    Number(match[1])
  )
  expect(html).toContain('<linearGradient')
  expect(parsedStops).toEqual([0, 0.5, 0.5, 1])
})

it('keeps ordered RGB transforms and alpha on individual gradient stops', () => {
  const value = structuredClone(gradient)
  value.stops[1].color.transforms = [
    { kind: 'tint', value: 50000 },
    { kind: 'alpha', value: 50000 },
  ]
  expect(normalizeGeometryDocument(documentWithGradient(value)).style.fill.gradient).toEqual(value)
})
it('derives premultiplied SVG samples between native alpha preset thirds', () => {
  const value = {
    kind: 'linear',
    angle: 0,
    scaled: true,
    rotWithShape: true,
    stops: [
      {
        pos: 0,
        color: { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'alpha', value: 25000 }] },
      },
      {
        pos: 100000,
        color: { kind: 'srgb', value: '0000FF', transforms: [{ kind: 'alpha', value: 75000 }] },
      },
    ],
  }
  const before = structuredClone(value)
  const paint = gradientPaintStops(value)
  expect(paint.find((stop) => stop.pos === Math.fround(1 / 3))).toEqual({
    pos: Math.fround(1 / 3),
    rgb: [169, 0, 85],
    alpha: 106,
  })
  expect(paint.find((stop) => stop.pos === Math.fround(2 / 3))).toEqual({
    pos: Math.fround(2 / 3),
    rgb: [84, 0, 170],
    alpha: 148,
  })
  const midpoint = paint.find((stop) => Math.abs(stop.pos - 0.5) < 1e-6)
  expect(midpoint).toBeDefined()
  expect(midpoint.rgb).toEqual([119, 0, 135])
  expect(midpoint.alpha).toBeCloseTo(127, 6)
  expect(value).toEqual(before)
})

it('quantizes native preset RGB at single precision before integer conversion', () => {
  const value = {
    ...gradient,
    stops: [
      {
        pos: 0,
        color: { kind: 'srgb', value: 'BDC7DB', transforms: [{ kind: 'alpha', value: 50000 }] },
      },
      { pos: 50000, color: { kind: 'srgb', value: '2C9A86' } },
      { pos: 100000, color: { kind: 'srgb', value: 'D89434' } },
    ],
  }
  const stops = gradientPaintStops(value)
  expect(stops.find((stop) => stop.pos === Math.fround(1 / 3) * 0.5)).toEqual({
    pos: Math.fround(1 / 3) * 0.5,
    rgb: [140, 183, 190],
    alpha: 170,
  })
  const nativeThird = stops.find((stop) => stop.pos === Math.fround(2 / 3) * 0.5)
  expect(nativeThird).toEqual({ pos: Math.fround(2 / 3) * 0.5, rgb: [92, 169, 162], alpha: 212 })
})

it('retains native normalized-float quantization even for a constant RGB channel', () => {
  const value = {
    ...gradient,
    stops: [
      {
        pos: 0,
        color: { kind: 'srgb', value: '030303', transforms: [{ kind: 'alpha', value: 25000 }] },
      },
      {
        pos: 100000,
        color: { kind: 'srgb', value: '030303', transforms: [{ kind: 'alpha', value: 75000 }] },
      },
    ],
  }
  const paint = gradientPaintStops(value)
  expect(paint.find((stop) => stop.pos === Math.fround(1 / 3))).toEqual({
    pos: Math.fround(1 / 3),
    rgb: [2, 2, 2],
    alpha: 106,
  })
  expect(paint.find((stop) => stop.pos === Math.fround(2 / 3))).toEqual({
    pos: Math.fround(2 / 3),
    rgb: [3, 3, 3],
    alpha: 148,
  })
})

it.each([
  [0, 100000],
  [100000, 0],
  [0, 0],
])('keeps transparent alpha interpolation finite and source stops intact: %j', (start, end) => {
  const value = {
    ...gradient,
    stops: [
      {
        pos: 0,
        color: { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'alpha', value: start }] },
      },
      {
        pos: 100000,
        color: { kind: 'srgb', value: '0000FF', transforms: [{ kind: 'alpha', value: end }] },
      },
    ],
  }
  const before = structuredClone(value)
  const stops = gradientPaintStops(value)
  expect(stops[0]).toEqual({ pos: 0, rgb: [255, 0, 0], alpha: Math.round((start * 255) / 100000) })
  expect(stops.at(-1)).toEqual({
    pos: 1,
    rgb: [0, 0, 255],
    alpha: Math.round((end * 255) / 100000),
  })
  for (const stop of stops) {
    expect(Number.isFinite(stop.alpha)).toBe(true)
    for (const channel of stop.rgb) {
      expect(Number.isInteger(channel)).toBe(true)
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(255)
    }
  }
  expect(value).toEqual(before)
})

it('does not interpolate across a duplicate-position alpha transition', () => {
  const value = structuredClone(gradient)
  value.stops[1].color.transforms = [{ kind: 'alpha', value: 25000 }]
  value.stops[2].color.transforms = [{ kind: 'alpha', value: 75000 }]
  const stops = gradientPaintStops(value)
  expect(stops.filter((stop) => stop.pos === 0.5)).toEqual([
    { pos: 0.5, rgb: [0, 255, 0], alpha: 64 },
    { pos: 0.5, rgb: [0, 0, 255], alpha: 191 },
  ])
})

it.each([
  { angle: -1 },
  { angle: 21600000 },
  { angle: 0.5 },
  { scaled: 'true' },
  { rotWithShape: false },
  { rotWithShape: 'true' },
  { kind: 'radial' },
  { unknown: true },
  { stops: [] },
  { stops: [{ pos: 0, color: { kind: 'srgb', value: 'FFFFFF' } }] },
  {
    stops: [
      { pos: 50000, color: { kind: 'srgb', value: 'FFFFFF' } },
      { pos: 0, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: -1, color: { kind: 'srgb', value: 'FFFFFF' } },
      { pos: 100000, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: 0.5, color: { kind: 'srgb', value: 'FFFFFF' } },
      { pos: 100000, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: 0, color: { kind: 'srgb', value: 'FFFFFF' } },
      { pos: 100001, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: 0, color: { kind: 'token', value: 'var(--ns-primary)' } },
      { pos: 100000, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: 0, color: { kind: 'none' } },
      { pos: 100000, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: 0, color: { kind: 'srgb', value: 'bad' } },
      { pos: 100000, color: { kind: 'srgb', value: '000000' } },
    ],
  },
  {
    stops: [
      { pos: 0, color: { kind: 'srgb', value: 'FFFFFF' }, extra: 1 },
      { pos: 100000, color: { kind: 'srgb', value: '000000' } },
    ],
  },
])('rejects malformed or currently unsupported gradient declarations atomically: %j', (patch) => {
  const valid = documentWithGradient()
  expect(normalizeGeometryDocument(valid).style.fill.gradient).toEqual(gradient)
  const bad = documentWithGradient({ ...gradient, ...patch })
  const before = structuredClone(bad)
  expect(() => normalizeGeometryDocument(bad)).toThrow()
  expect(bad).toEqual(before)
})
