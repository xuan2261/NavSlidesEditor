import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const {
  deriveNativeOutline,
  supportsNativeOutline,
} = require('../../shared/src/pptx-geometry-outline')
const { multiply, transformPoint } = require('../../shared/src/pptx-affine')
const profile = (change = {}) => ({
  compound: 'dbl',
  alignment: 'ctr',
  cap: 'flat',
  dash: { kind: 'preset', value: 'solid' },
  join: { kind: 'miter', limit: 800000 },
  ...change,
})
const path = (coordinates, closed = false) => {
  const points = coordinates.map(([x, y]) => ({ x, y }))
  return {
    transform: [1, 0, 0, 1, 0, 0],
    segments: [
      { kind: 'moveTo', points: [points[0]] },
      ...points.slice(1).map((p, i) => ({ kind: 'lnTo', points: [points[i], p] })),
      ...(closed ? [{ kind: 'close', points: [points.at(-1), points[0]] }] : []),
    ],
  }
}
function winding(contours, x, y) {
  let value = 0
  for (const contour of contours)
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i],
        b = contour[(i + 1) % contour.length]
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
      if (a.y <= y && b.y > y && cross > 0) value++
      if (a.y > y && b.y <= y && cross < 0) value--
    }
  return value
}
it('keeps multiple directional holes and islands under nested reflected affine transport', () => {
  const rings = [
    path(
      [
        [0, 0],
        [200, 0],
        [200, 160],
        [0, 160],
      ],
      true
    ),
    path(
      [
        [20, 20],
        [20, 140],
        [180, 140],
        [180, 20],
      ],
      true
    ),
    path(
      [
        [60, 60],
        [140, 60],
        [140, 100],
        [60, 100],
      ],
      true
    ),
  ]
  const source = {
    ...rings[0],
    segments: rings.flatMap((p) => p.segments),
    transform: multiply([0, 2, -3, 0, 100, 50], [-1, 0.3, 0, 1, 200, 10]),
  }
  const before = structuredClone(source)
  const outline = deriveNativeOutline(
    source,
    profile({ compound: 'thinThick', alignment: 'in' }),
    10
  )
  const world = outline.contours.map((c) => c.map((p) => transformPoint(outline.transform, p)))
  for (const [y, ink] of [
    [1, 1],
    [3, 0],
    [7, 1],
    [13, 1],
    [17, 0],
    [19, 1],
    [40, 0],
    [61, 1],
    [63, 0],
    [67, 1],
    [80, 0],
  ]) {
    const p = transformPoint(source.transform, { x: 100, y })
    expect(winding(world, p.x, p.y)).toBe(ink ? -1 : 0)
  }
  expect(source).toEqual(before)
})
it.each([
  { kind: 'custom', stops: [] },
  { kind: 'custom', stops: [{ dash: -1, space: 100000 }] },
  { kind: 'custom', stops: [{ dash: Infinity, space: 1 }] },
  { kind: 'custom', stops: [{ dash: 0, space: 0 }] },
])('rejects non-progressing or invalid dash schedules: %j', (dash) => {
  const stroke = profile({ dash })
  expect(supportsNativeOutline(stroke)).toBe(false)
  expect(() =>
    deriveNativeOutline(
      path([
        [0, 0],
        [100, 0],
      ]),
      stroke,
      12
    )
  ).toThrow()
})
it('rejects folded inner boundaries and self-intersecting directional closed subpaths atomically', () => {
  const source = path(
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    true
  )
  const before = structuredClone(source)
  expect(() =>
    deriveNativeOutline(source, profile({ alignment: 'in', join: { kind: 'round' } }), 20)
  ).toThrow()
  expect(source).toEqual(before)
  expect(() =>
    deriveNativeOutline(
      path(
        [
          [0, 0],
          [100, 100],
          [0, 100],
          [100, 0],
        ],
        true
      ),
      profile({ alignment: 'in' }),
      12
    )
  ).toThrow()
})
