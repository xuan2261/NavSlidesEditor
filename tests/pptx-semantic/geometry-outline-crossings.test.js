import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { deriveNativeOutline } = require('../../shared/src/pptx-geometry-outline')
function path(coordinates, closed = false) {
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
function covered(outline, x, y) {
  let value = 0
  for (const c of outline.contours)
    for (let i = 0; i < c.length; i++) {
      const a = c[i],
        b = c[(i + 1) % c.length]
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
      if (a.y <= y && b.y > y && cross > 0) value++
      if (a.y > y && b.y <= y && cross < 0) value--
    }
  return value
}
const profile = (cap, stops) => ({
  compound: 'dbl',
  alignment: 'ctr',
  cap,
  join: { kind: 'miter', limit: 800000 },
  dash: { kind: 'custom', stops },
})
it('does not let a folded start erase a remote segment inside the same dash', () => {
  const source = path([
    [0, 0],
    [1, 0],
    [1, 100],
    [-100, 100],
    [-100, 200],
    [-6, 200],
    [-6, -100],
  ])
  const stroke = profile('flat', [{ dash: 100000000, space: 100000 }])
  const before = structuredClone(source)
  const outline = deriveNativeOutline(source, stroke, 12)
  const isolated = deriveNativeOutline(
    path([
      [-6, 200],
      [-6, -100],
    ]),
    stroke,
    12
  )
  expect(covered(isolated, -0.5, 4)).toBe(1)
  expect(covered(outline, -0.5, 4)).toBe(1)
  expect(source).toEqual(before)
})
it.each(['rnd', 'sq'])('retains a zero-length outgoing %s dot at the closed seam', (cap) => {
  const source = path(
    [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    true
  )
  const stroke = profile(cap, [
    { dash: 0, space: 100000 },
    { dash: 4000000, space: 100000 },
  ])
  const before = structuredClone(source)
  const outline = deriveNativeOutline(source, stroke, 12)
  expect(covered(outline, 0, -5)).toBe(1)
  expect(covered(outline, 50, 50)).toBe(0)
  expect(source).toEqual(before)
})
