import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { deriveNativeOutline } = require('../../shared/src/pptx-geometry-outline')
const { dashPattern } = require('../../shared/src/pptx-geometry-outline-dash')
const { PRESET_DASH_PATTERNS } = require('../../shared/src/pptx-geometry-document')
const style = (cap = 'flat', stops = [{ dash: 100000, space: 100000 }]) => ({
  compound: 'dbl',
  alignment: 'ctr',
  cap,
  dash: { kind: 'custom', stops },
  join: { kind: 'round' },
})
const line = {
  transform: [1, 0, 0, 1, 0, 0],
  segments: [
    { kind: 'moveTo', points: [{ x: 0, y: 0 }] },
    {
      kind: 'lnTo',
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
  ],
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
it('keeps preset schedules identical to the canonical single-stroke width units', () => {
  for (const [value, expected] of Object.entries(PRESET_DASH_PATTERNS))
    expect(dashPattern({ kind: 'preset', value })).toEqual(expected)
})
it.each(['flat', 'rnd', 'sq'])('retains explicit zero-length dash dots with %s caps', (cap) => {
  const outline = deriveNativeOutline(line, style(cap, [{ dash: 0, space: 100000 }]), 12)
  expect(covered(outline, 0.5, 4)).toBe(cap === 'flat' ? 0 : 1)
  expect(covered(outline, 12.5, -4)).toBe(cap === 'flat' ? 0 : 1)
  expect(covered(outline, 6, 4)).toBe(0)
  expect(covered(outline, 12, 0)).toBe(0)
})
it('merges zero-space intervals without adding caps at internal dash boundaries', () => {
  const outline = deriveNativeOutline(line, style('rnd', [{ dash: 100000, space: 0 }]), 12)
  const solid = deriveNativeOutline(
    line,
    { ...style('rnd'), dash: { kind: 'preset', value: 'solid' } },
    12
  )
  expect(outline.contours).toEqual(solid.contours)
})
it.each(['ctr', 'in'])(
  'bounds accumulated dash phase on an analytic circular arc: %s',
  (alignment) => {
    const source = {
      transform: [-2, 0.4, 0.7, 1, 100, 20],
      segments: [
        { kind: 'moveTo', points: [{ x: 100, y: 0 }] },
        {
          kind: 'arcTo',
          points: [
            { x: 100, y: 0 },
            { x: 0, y: 100 },
          ],
          radii: [100, 100],
          center: { x: 0, y: 0 },
          angle: 0,
          sweep: Math.PI / 2,
        },
      ],
    }
    const before = structuredClone(source)
    const outline = deriveNativeOutline(source, { ...style(), alignment }, 12, { maxScale: 3 })
    for (let end = 12; end < 150; end += 24)
      for (const delta of [-0.04, 0.04]) {
        const angle = (end + delta) / 100
        for (const normal of alignment === 'ctr' ? [-4, 4] : [2, 10]) {
          const radius = 100 - normal
          expect(covered(outline, radius * Math.cos(angle), radius * Math.sin(angle))).toBe(
            delta < 0 ? 1 : 0
          )
        }
      }
    expect(source).toEqual(before)
  }
)
it('bounds quadratic dash phase against the analytic parabola arc-length integral', () => {
  const source = {
    ...line,
    segments: [
      line.segments[0],
      {
        kind: 'quadBezTo',
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 100 },
        ],
      },
    ],
  }
  const outline = deriveNativeOutline(source, style(), 12)
  const atLength = (length) => {
    let low = 0,
      high = 2
    for (let i = 0; i < 60; i++) {
      const u = (low + high) / 2
      if (25 * (u * Math.sqrt(1 + u * u) + Math.asinh(u)) < length) low = u
      else high = u
    }
    const u = (low + high) / 2,
      x = 50 * u,
      n = Math.hypot(1, u)
    return { x: x - (4 * u) / n, y: (x * x) / 100 + 4 / n }
  }
  for (let end = 12; end < 145; end += 24)
    for (const delta of [-0.04, 0.04]) {
      const p = atLength(end + delta)
      expect(covered(outline, p.x, p.y)).toBe(delta < 0 ? 1 : 0)
    }
})
it('rejects resource-exhausting dash intervals before returning partial coverage', () => {
  const source = structuredClone(line),
    before = structuredClone(source)
  expect(() =>
    deriveNativeOutline(source, style('flat', [{ dash: 1e-8, space: 1e-8 }]), 12)
  ).toThrow(/budget/)
  expect(source).toEqual(before)
})
it('classifies a near-cutoff curve join from its exact tangent, not its final chord', () => {
  const ratio = 1.5 + 1e-8
  const cosine = 2 / ratio ** 2 - 1,
    sine = Math.sqrt(1 - cosine ** 2)
  const source = {
    ...line,
    segments: [
      line.segments[0],
      {
        kind: 'quadBezTo',
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      },
      {
        kind: 'lnTo',
        points: [
          { x: 100, y: 100 },
          { x: 100 + 100 * sine, y: 100 + 100 * cosine },
        ],
      },
    ],
  }
  const stroke = {
    ...style(),
    dash: { kind: 'preset', value: 'solid' },
    join: { kind: 'miter', limit: 150000 },
  }
  const outline = deriveNativeOutline(source, stroke, 12)
  const nx = -1 - cosine,
    ny = sine,
    length = Math.hypot(nx, ny)
  expect(covered(outline, 100 + (8 * nx) / length, 100 + (8 * ny) / length)).toBe(0)
})
it('retains the exact miter at the authored cutoff equality', () => {
  const source = {
    ...line,
    segments: [
      ...line.segments,
      {
        kind: 'quadBezTo',
        points: [
          { x: 100, y: 0 },
          { x: 107, y: -24 },
          { x: 100, y: -100 },
        ],
      },
    ],
  }
  const outline = deriveNativeOutline(
    source,
    {
      ...style(),
      alignment: 'in',
      dash: { kind: 'preset', value: 'solid' },
      join: { kind: 'miter', limit: 125000 },
    },
    10
  )
  expect(covered(outline, 106, 9)).toBe(1)
})
