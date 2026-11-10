// Portable production-caller regressions derived from the 32-case PowerPoint
// probe in resume-native-preset19-20-calibration.md, not native qualification.
import { describe, expect, it } from 'vitest'
import affine from '../../shared/src/pptx-affine.js'
import svg from '../../shared/src/pptx-geometry-svg.js'
import effects from '../../shared/src/pptx-geometry-effects.js'

const vertices = [
  [0, 0],
  [100, 0],
  [100, 30],
  [65, 30],
  [65, 100],
  [0, 100],
]
const variants = [
  {},
  { dist: 0, dir: 0 },
  { dist: 228600 },
  { dir: 5400000 },
  { dist: 228600, dir: 2700000 },
  { dist: 228600, dir: 2700000, rotation: 1800000 },
  { dist: 228600, dir: 2700000, flipH: true },
  { dist: 228600, dir: 2700000, flipV: true },
]
const cases = ['shdw19', 'shdw20'].flatMap((prst) =>
  [
    [120, 60],
    [60, 120],
  ].flatMap(([width, height]) => variants.map((variant) => ({ prst, width, height, ...variant })))
)
const color = { kind: 'srgb', value: '2060c0' }
const point = (m, p) => affine.transformPoint(m, p)
function fixture(c) {
  const local = vertices.map(([x, y]) => ({ x: (x * c.width) / 100, y: (y * c.height) / 100 }))
  const effect = {
    kind: 'prstShdw',
    prst: c.prst,
    color,
    ...Object.fromEntries(['dist', 'dir'].filter((k) => c[k] !== undefined).map((k) => [k, c[k]])),
  }
  const geometry = {
    schemaVersion: 1,
    componentId: 'native-preset-geometry',
    kind: 'custom',
    width: c.width * 9525,
    height: c.height * 9525,
    adjustments: [],
    guides: [],
    handles: [],
    paths: [
      {
        componentId: 'native-preset-path',
        commands: [
          ...local.map((p, i) => ({
            kind: i ? 'lnTo' : 'moveTo',
            points: [{ componentId: `native-preset-point-${i}`, x: p.x * 9525, y: p.y * 9525 }],
          })),
          { kind: 'close' },
        ],
      },
    ],
    style: {
      fill: { color: { kind: 'srgb', value: 'e02030' } },
      effects: { kind: 'list', effects: [effect] },
    },
  }
  const matrix = affine.leafTransform({
    off: { x: 55, y: 65 },
    ext: { cx: c.width, cy: c.height },
    ...Object.fromEntries(
      ['rotation', 'flipH', 'flipV'].filter((k) => c[k] !== undefined).map((k) => [k, c[k]])
    ),
  })
  return {
    geometry,
    local,
    matrix,
    options: {
      width: c.width,
      height: c.height,
      fill: '#e02030',
      stroke: 'none',
      strokeWidth: 0,
      occurrenceMatrix: matrix,
    },
  }
}
function shadowMatrix(markup) {
  const match = markup.match(
    /data-pptx-geometry-shadow="[^"]+" transform="matrix\(([^)]+)\)"><g filter="[^"]+"><g transform="matrix\(([^)]+)\)">/
  )
  expect(match).not.toBeNull()
  return affine.multiply(...match.slice(1).map((v) => v.trim().split(/\s+/).map(Number)))
}
function checkVertices(c, f, localMatrix) {
  const source = f.local.map((p) => point(f.matrix, p))
  const bottom = Math.max(...source.map((p) => p.y))
  const angle = ((c.dir ?? 0) * Math.PI) / 10800000,
    distance = (c.dist ?? 0) / 9525
  const scale = c.prst === 'shdw19' ? 0.5 : -1
  source.forEach((p, i) => {
    const actual = point(f.matrix, point(localMatrix, f.local[i]))
    expect(actual.x).toBeCloseTo(p.x + distance * Math.cos(angle), 5)
    expect(actual.y).toBeCloseTo(bottom + scale * (p.y - bottom) + distance * Math.sin(angle), 5)
  })
}
describe('native-derived preset shadow ink envelope', () => {
  it.each(cases)('renders the native affine for %j without changing source', (c) => {
    const f = fixture(c),
      before = structuredClone(f.geometry)
    const markup = svg.geometrySvgPathsString(f.geometry, f.options)
    checkVertices(c, f, shadowMatrix(markup))
    expect(f.geometry).toEqual(before)
    expect([...markup.matchAll(/data-pptx-geometry-shadow=/g)]).toHaveLength(1)
  })

  it('uses supplied transformed ink bounds rather than the rotated full rectangle', () => {
    const c = cases.find((entry) => entry.prst === 'shdw19' && entry.rotation)
    const f = fixture(c),
      frame = [...f.matrix.slice(0, 4), 0, 0]
    const points = f.local.map((p) => point(frame, p))
    const bounds = [
      Math.min(...points.map((p) => p.x)),
      Math.min(...points.map((p) => p.y)),
      Math.max(...points.map((p) => p.x)),
      Math.max(...points.map((p) => p.y)),
    ]
    const out = effects.geometryEffectFrame(
      {
        kind: 'outerShdw',
        color,
        sy: 50000,
        algn: 'b',
        rotWithShape: false,
        dist: c.dist,
        dir: c.dir,
      },
      { ...f.options, bounds: [0, 0, c.width, c.height], anchorBounds: bounds }
    )
    checkVertices(c, f, affine.multiply(out.inverse, out.maskTransform))
  })

  it('finds a preset inside an authored DAG container', () => {
    const c = cases[5],
      f = fixture(c)
    f.geometry.style.effects = {
      kind: 'dag',
      type: 'tree',
      effects: [{ kind: 'cont', type: 'tree', effects: f.geometry.style.effects.effects }],
    }
    checkVertices(c, f, shadowMatrix(svg.geometrySvgPathsString(f.geometry, f.options)))
  })

  it('excludes nonpainted paths from the anchor envelope', () => {
    const c = cases[5],
      f = fixture(c)
    const hidden = structuredClone(f.geometry.paths[0])
    hidden.componentId = 'hidden-path'
    hidden.fill = 'none'
    hidden.commands.forEach((command) =>
      command.points?.forEach((p) => {
        p.componentId += '-hidden'
        p.y += 1000 * 9525
      })
    )
    f.geometry.paths.push(hidden)
    checkVertices(c, f, shadowMatrix(svg.geometrySvgPathsString(f.geometry, f.options)))
  })
})
