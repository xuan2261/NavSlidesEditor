import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { deriveNativeOutline } = require('../../shared/src/pptx-geometry-outline')
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
const covered = (outline, x, y) => winding(outline.contours, x, y)
const area = (outline) =>
  outline.contours.reduce(
    (sum, c) =>
      sum +
      c.reduce((a, p, i) => {
        const q = c[(i + 1) % c.length]
        return a + (p.x * q.y - p.y * q.x) / 2
      }, 0),
    0
  )
it.each(['flat', 'sq', 'rnd'])(
  'sweeps %s caps per band without bridging transparent gaps',
  (cap) => {
    const source = path([
      [0, 0],
      [100, 0],
    ])
    const stroke = profile({ cap })
    const before = structuredClone({ source, stroke })
    const outline = deriveNativeOutline(source, stroke, 12)
    expect(outline.bounds).toEqual(cap === 'flat' ? [0, -6, 100, 6] : [-2, -6, 102, 6])
    expect(covered(outline, -1, -4)).toBe(cap === 'flat' ? 0 : 1)
    expect(covered(outline, -1.8, -5.8)).toBe(cap === 'sq' ? 1 : 0)
    expect(covered(outline, 0.1, 0)).toBe(0)
    expect(covered(outline, 50, 4)).toBe(1)
    const expectedArea = cap === 'flat' ? 800 : cap === 'sq' ? 832 : 800 + 8 * Math.PI
    expect(Math.abs(area(outline) - expectedArea)).toBeLessThan(0.2)
    expect({ source, stroke }).toEqual(before)
  }
)
it.each(['round', 'bevel', 'miter'])(
  'uses signed %s corner offsets rather than translated strokes',
  (kind) => {
    const outline = deriveNativeOutline(
      path([
        [0, 0],
        [100, 0],
        [100, 100],
      ]),
      profile({ join: kind === 'miter' ? { kind, limit: 100000 } : { kind } }),
      12
    )
    expect(covered(outline, 104, -4)).toBe(kind === 'round' ? 1 : 0)
    expect(covered(outline, 103, -1)).toBe(1)
    expect(covered(outline, 100.5, -0.5)).toBe(0)
    expect(covered(outline, 96, 4)).toBe(1)
  }
)
it('uses an authored high miter limit, and bevels only the outer corner at the cutoff', () => {
  const source = path([
    [0, 0],
    [100, 0],
    [0, 10],
  ])
  const high = deriveNativeOutline(source, profile({ join: { kind: 'miter', limit: 2200000 } }), 4)
  const low = deriveNativeOutline(source, profile(), 4)
  expect(high.bounds[2]).toBeGreaterThan(140)
  expect(low.bounds[2]).toBeLessThan(101)
  expect(covered(low, 50, -1)).toBe(1)
})
it.each(['dash', 'sysDash', 'dashDot', 'lgDashDotDot'])(
  'shares the full-width %s schedule across bands',
  (value) => {
    const outline = deriveNativeOutline(
      path([
        [0, 0],
        [240, 0],
      ]),
      profile({ dash: { kind: 'preset', value } }),
      12
    )
    const firstEnd = { dash: 4, sysDash: 3, dashDot: 4, lgDashDotDot: 8 }[value] * 12
    for (const y of [-4, 4]) {
      expect(covered(outline, firstEnd - 1, y)).toBe(1)
      expect(covered(outline, firstEnd + 1, y)).toBe(0)
    }
    expect(covered(outline, 10, 0)).toBe(0)
  }
)
it('uses centerline distance through corners and merges a closed dash across its seam', () => {
  const dash = { kind: 'custom', stops: [{ dash: 150000, space: 50000 }] }
  const bent = deriveNativeOutline(
    path([
      [0, 0],
      [10, 0],
      [10, 40],
    ]),
    profile({ dash }),
    12
  )
  expect(covered(bent, 14, 6)).toBe(1)
  expect(covered(bent, 14, 10)).toBe(0)
  expect(covered(bent, 14, 16)).toBe(1)
  const closed = deriveNativeOutline(
    path(
      [
        [0, 0],
        [25, 0],
        [25, 25],
        [0, 25],
      ],
      true
    ),
    profile({ dash: { kind: 'custom', stops: [{ dash: 300000, space: 100000 }] } }),
    12
  )
  expect(covered(closed, -4, -4)).toBe(1)
  expect(covered(closed, 0, 0)).toBe(0)
})
it('restarts dash phase at each authored subpath and unions overlapping ink once', () => {
  const first = path([
      [0, 0],
      [30, 0],
    ]),
    second = path([
      [0, 0],
      [0, 30],
    ])
  const outline = deriveNativeOutline(
    { ...first, segments: [...first.segments, ...second.segments] },
    profile({ cap: 'rnd', dash: { kind: 'custom', stops: [{ dash: 100000, space: 100000 }] } }),
    12
  )
  expect(covered(outline, 4, 4)).toBe(1)
  expect(covered(outline, 4, 18)).toBe(0)
  expect(covered(outline, 18, 4)).toBe(0)
  expect(covered(outline, 0, 0)).toBe(0)
})
it.each(['rnd', 'sq'])(
  'retains the %s cap when a short corner dash has a folded inner strip',
  (cap) => {
    const outline = deriveNativeOutline(
      path([
        [0, 0],
        [1, 0],
        [1, 100],
      ]),
      profile({ cap, dash: { kind: 'custom', stops: [{ dash: 25000, space: 10000000 }] } }),
      12
    )
    expect(covered(outline, -1, 5)).toBe(1)
    expect(outline.bounds[3]).toBe(6)
  }
)
