import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const {
  deriveNativeOutline,
  supportsNativeOutline,
} = require('../../shared/src/pptx-geometry-outline')
const { deriveGeometryPaths } = require('../../shared/src/pptx-geometry-document')
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { readGeometrySource } = require('../../server/services/pptx-import/ooxml-geometry-source')
const profile = (compound = 'sng', alignment = 'ctr') => ({
  compound,
  alignment,
  cap: 'flat',
  dash: { kind: 'preset', value: 'solid' },
  join: { kind: 'miter', limit: 800000 },
})
const point = (x, y) => ({ x, y })
function path(points, closed = false) {
  return {
    transform: [1, 0, 0, 1, 0, 0],
    segments: [
      { kind: 'moveTo', points: [points[0]] },
      ...points.slice(1).map((p, i) => ({ kind: 'lnTo', points: [points[i], p] })),
      ...(closed ? [{ kind: 'close', points: [points.at(-1), points[0]] }] : []),
    ],
  }
}
function winding(outline, x, y) {
  let value = 0
  for (const contour of outline.contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i],
        b = contour[(i + 1) % contour.length]
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
      if (a.y <= y && b.y > y && cross > 0) value++
      if (a.y > y && b.y <= y && cross < 0) value--
    }
  }
  return value
}
function area(outline) {
  return outline.contours.reduce(
    (sum, contour) =>
      sum +
      contour.reduce((a, p, i) => {
        const q = contour[(i + 1) % contour.length]
        return a + (p.x * q.y - p.y * q.x) / 2
      }, 0),
    0
  )
}
const bands = {
  sng: [[-0.5, 0.5]],
  dbl: [
    [-0.5, -1 / 6],
    [1 / 6, 0.5],
  ],
  thinThick: [
    [-0.5, -0.3],
    [-0.1, 0.5],
  ],
  thickThin: [
    [-0.5, 0.1],
    [0.3, 0.5],
  ],
  tri: [
    [-0.5, -1 / 3],
    [-1 / 6, 1 / 6],
    [1 / 3, 0.5],
  ],
}
it.each(
  Object.entries(bands).flatMap(([compound, intervals]) =>
    ['ctr', 'in'].map((alignment) => [compound, alignment, intervals])
  )
)('preserves measured signed bands and flat endpoints: %s/%s', (compound, alignment, intervals) => {
  const outline = deriveNativeOutline(
    path([point(0, 0), point(100, 0)]),
    profile(compound, alignment),
    40
  )
  const shift = alignment === 'in' ? 0.5 : 0
  expect(outline.bounds).toEqual([0, (-0.5 + shift) * 40, 100, (0.5 + shift) * 40])
  for (let y = -24.5; y <= 44.5; y++) {
    const covered = intervals.some(([a, b]) => y > (a + shift) * 40 && y < (b + shift) * 40)
    expect(winding(outline, 50, y), `normal ${y}`).toBe(covered ? 1 : 0)
  }
  expect(winding(outline, -0.1, 5)).toBe(0)
  expect(outline.fillRule).toBe('nonzero')
  expect(outline.d).toMatch(/^M /)
})
it('constructs miter coverage at a genuine corner rather than translating strokes', () => {
  const outline = deriveNativeOutline(
    path([point(0, 0), point(100, 0), point(100, 100)]),
    profile('dbl'),
    12
  )
  expect(outline.bounds).toEqual([0, -6, 106, 100])
  expect(winding(outline, 104, -4)).toBe(1)
  expect(winding(outline, 100, 0)).toBe(0)
  expect(winding(outline, 96, 4)).toBe(1)
  expect(area(outline)).toBeCloseTo(1600, 4)
})
it.each(['ctr', 'in'])('retains the real closed rectangle interior and gaps: %s', (alignment) => {
  const rect = path([point(0, 0), point(100, 0), point(100, 80), point(0, 80)], true)
  const outline = deriveNativeOutline(rect, profile('dbl', alignment), 12)
  expect(outline.bounds).toEqual(alignment === 'in' ? [0, 0, 100, 80] : [-6, -6, 106, 86])
  expect(winding(outline, 50, 40)).toBe(0)
  expect(winding(outline, 50, alignment === 'in' ? 6 : 0)).toBe(0)
  expect(winding(outline, 50, alignment === 'in' ? 2 : 4)).toBe(1)
})
it.each(
  Object.entries(bands).flatMap(([compound, intervals]) =>
    ['ctr', 'in'].map((alignment) => [compound, alignment, intervals])
  )
)(
  'keeps native signed bands for raw reverse traversal and CCW closure: %s/%s',
  (compound, alignment, intervals) => {
    // Independently authored PowerPoint topology source preserves these point
    // orders without flipH. Inset CCW ink is outside, not clipped to fill.
    const reversed = path([point(100, 0), point(0, 0)])
    const counterclockwise = path([point(0, 0), point(0, 80), point(100, 80), point(100, 0)], true)
    for (const source of [reversed, counterclockwise]) {
      const before = structuredClone(source)
      const outline = deriveNativeOutline(source, profile(compound, alignment), 12)
      for (let y = -16.5; y <= 16.5; y++) {
        const shift = alignment === 'in' ? 0.5 : 0
        const covered = intervals.some(([a, b]) => -y > (a + shift) * 12 && -y < (b + shift) * 12)
        expect(winding(outline, 50, y), `normal ${-y}`).toBe(covered ? 1 : 0)
      }
      expect(source).toEqual(before)
    }
  }
)
it('unions overlapping branches without erasing another branch with a compound gap', () => {
  const horizontal = path([point(-50, 0), point(50, 0)])
  const vertical = path([point(0, -50), point(0, 50)])
  const outline = deriveNativeOutline(
    { ...horizontal, segments: [...horizontal.segments, ...vertical.segments] },
    profile('dbl'),
    12
  )
  expect(winding(outline, 4, 4)).toBe(1)
  expect(winding(outline, 4, 0)).toBe(1)
  expect(winding(outline, 0, 0)).toBe(0)
  expect(area(outline)).toBeCloseTo(1536, 4)
})
it('unions a self-crossing open ribbon into one logical paint', () => {
  const outline = deriveNativeOutline(
    path([point(0, 0), point(100, 100), point(0, 100), point(100, 0)]),
    profile(),
    8
  )
  expect(winding(outline, 50, 50)).toBe(1)
  expect(winding(outline, 50, 25)).toBe(0)
})
it('transports bands under reflection and shear without rewriting source or swapping sides', () => {
  const source = path([point(0, 0), point(100, 0)])
  source.transform = [-1, 0.5, 0.4, 2, 100, 7]
  const before = structuredClone(source)
  const outline = deriveNativeOutline(source, profile('thinThick', 'in'), 10)
  expect(outline.transform).toEqual(source.transform)
  expect(outline.bounds).toEqual([0, 0, 100, 10])
  expect(winding(outline, 50, 3)).toBe(0)
  expect(winding(outline, 50, 8)).toBe(1)
  expect(source).toEqual(before)
})
it('consumes actual projected segments on a zero-height native extent', () => {
  const geometry = {
    schemaVersion: 1,
    componentId: 'g',
    kind: 'custom',
    width: 952500,
    height: 0,
    paths: [
      {
        componentId: 'p',
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'a', x: 0, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: 'b', x: 952500, y: 0 }] },
        ],
      },
    ],
  }
  const derived = deriveGeometryPaths(geometry, {
    projectToLocal: true,
    localScale: [1 / 9525, 1 / 9525],
  })
  expect(deriveNativeOutline(derived.paths[0], profile('tri', 'in'), 12).bounds).toEqual([
    0, 0, 100, 12,
  ])
})
it.each(['quadBezTo', 'cubicBezTo'])(
  'adaptively sweeps %s with genuine curvature and flat endpoint tangents',
  (kind) => {
    const points =
      kind === 'quadBezTo'
        ? [point(0, 0), point(50, 100), point(100, 0)]
        : [point(0, 0), point(0, 100), point(100, 100), point(100, 0)]
    const source = {
      transform: [1, 0, 0, 1, 0, 0],
      segments: [
        { kind: 'moveTo', points: [points[0]] },
        { kind, points },
      ],
    }
    const outline = deriveNativeOutline(source, profile(), 4)
    const top = kind === 'quadBezTo' ? 50 : 75
    expect(outline.bounds[3]).toBeCloseTo(top + 2, 2)
    expect(winding(outline, 50, top + 1)).toBe(1)
    expect(winding(outline, 50, top - 3)).toBe(0)
    expect(outline.errorBound).toBeLessThanOrEqual(0.02)
  }
)
it('bounds an elliptical arc ribbon, with adaptive refinement at eccentric curvature', () => {
  const source = {
    transform: [1, 0, 0, 1, 0, 0],
    segments: [
      { kind: 'moveTo', points: [point(100, 0)] },
      {
        kind: 'arcTo',
        points: [point(100, 0), point(0, 30)],
        center: point(0, 0),
        radii: [100, 30],
        angle: 0,
        sweep: Math.PI / 2,
      },
    ],
  }
  const outline = deriveNativeOutline(source, profile('dbl'), 4)
  expect(outline.bounds[2]).toBeCloseTo(102, 2)
  expect(outline.bounds[3]).toBeCloseTo(32, 2)
  expect(winding(outline, 100.9, 1)).toBe(1)
  expect(winding(outline, 100, 1)).toBe(0)
})
it('covers the observed 600 by 240 point ellipse at the observed 30 point inset width', () => {
  const source = {
    transform: [1, 0, 0, 1, 0, 0],
    segments: [{ kind: 'moveTo', points: [point(800, 160)] }],
  }
  for (let i = 0; i < 4; i++) {
    const at = (a) => point(400 + 400 * Math.cos(a), 160 + 160 * Math.sin(a))
    source.segments.push({
      kind: 'arcTo',
      points: [source.segments.at(-1).points.at(-1), at(((i + 1) * Math.PI) / 2)],
      center: point(400, 160),
      radii: [400, 160],
      angle: (i * Math.PI) / 2,
      sweep: Math.PI / 2,
    })
  }
  source.segments.push({
    kind: 'close',
    points: [source.segments.at(-1).points.at(-1), point(800, 160)],
  })
  const outline = deriveNativeOutline(source, profile('tri', 'in'), 40)
  outline.bounds.forEach((value, i) => expect(value).toBeCloseTo([0, 0, 800, 320][i], 2))
  expect(winding(outline, 400, 160)).toBe(0)
  expect(winding(outline, 400, 10)).toBe(0)
  expect(winding(outline, 400, 20)).toBe(1)
})
it.each(
  Object.keys(bands).flatMap((compound) => ['ctr', 'in'].map((alignment) => [compound, alignment]))
)(
  'sweeps genuine native preset ellipse without closing-edge reversal: %s/%s',
  (compound, alignment) => {
    const node = parseXml(
      '<a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="ellipse"><a:avLst/></a:prstGeom>'
    )[0]
    const geometry = readGeometrySource(node, {
      componentId: 'native-ellipse',
      width: 7620000,
      height: 3048000,
    })
    const before = structuredClone(geometry)
    const derived = deriveGeometryPaths(geometry, {
      projectToLocal: true,
      localScale: [1 / 9525, 1 / 9525],
    })
    expect(derived.paths[0].segments.at(-1).points[0]).not.toEqual(
      derived.paths[0].segments.at(-1).points[1]
    )
    const outline = deriveNativeOutline(derived.paths[0], profile(compound, alignment), 40)
    const bounds = alignment === 'ctr' ? [-20, -20, 820, 340] : [0, 0, 800, 320]
    outline.bounds.forEach((value, index) => expect(value).toBeCloseTo(bounds[index], 2))
    expect(winding(outline, 400, 160)).toBe(0)
    expect(geometry).toEqual(before)
  }
)
it.each([
  { cap: 'invented' },
  { dash: { kind: 'preset', value: 'invented' } },
  { join: { kind: 'invented' } },
  { join: { kind: 'miter', limit: -1 } },
  { headEnd: { type: 'triangle' } },
  { compound: 'invented' },
  { alignment: 'out' },
  { cap: undefined },
  { dash: undefined },
  { join: undefined },
])('rejects unobserved profiles without a single-centered fallback: %j', (change) => {
  const stroke = { ...profile(), ...change }
  expect(supportsNativeOutline(stroke)).toBe(false)
  expect(() => deriveNativeOutline(path([point(0, 0), point(10, 0)]), stroke, 4)).toThrow()
})
it('rejects unsupported reversals and coordinate budgets', () => {
  const points = [point(0, 0), point(100, 0), point(0, 0)]
  expect(() => deriveNativeOutline(path(points), profile(), 4)).toThrow()
  expect(() => deriveNativeOutline(path([point(0, 0), point(1e12, 0)]), profile(), 4)).toThrow()
})
it('retains signed inset bands around opposing closed contours without filling the hole', () => {
  const outer = path([point(0, 0), point(100, 0), point(100, 80), point(0, 80)], true)
  const hole = path([point(20, 20), point(20, 60), point(80, 60), point(80, 20)], true)
  const source = { ...outer, segments: [...outer.segments, ...hole.segments] }
  const before = structuredClone(source)
  const outline = deriveNativeOutline(source, profile('dbl', 'in'), 6)
  expect(outline.bounds).toEqual([0, 0, 100, 80])
  for (const [y, covered] of [
    [1, 1],
    [3, 0],
    [5, 1],
    [15, 1],
    [17, 0],
    [19, 1],
    [21, 0],
    [40, 0],
  ])
    expect(winding(outline, 50, y)).toBe(covered)
  expect(source).toEqual(before)
})
it('does not invent ink for disabled, zero-width or zero-length paths', () => {
  const source = path([point(5, 5), point(5, 5)])
  for (const [p, width] of [
    [source, 4],
    [path([point(0, 0), point(10, 0)]), 0],
    [{ ...source, stroke: false }, 4],
  ]) {
    const outline = deriveNativeOutline(p, profile(), width)
    expect(outline.d).toBe('')
    expect(outline.bounds).toBeNull()
  }
})
