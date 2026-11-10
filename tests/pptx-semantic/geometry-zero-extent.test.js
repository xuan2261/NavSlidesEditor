import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import {
  groupTransform,
  leafTransform,
  invert,
  multiply,
  transformPoint,
} from '../../shared/src/pptx-affine'

const require = createRequire(import.meta.url)
const geometryCore = require('../../shared/src/pptx-geometry-document.js')
function line(width, height) {
  return {
    schemaVersion: 1,
    componentId: 'geometry',
    kind: 'custom',
    width,
    height,
    paths: [
      {
        componentId: 'path',
        fill: 'none',
        stroke: true,
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: 'end', x: 'w', y: 'h' }] },
        ],
      },
    ],
  }
}
describe('authored zero-extent leaf geometry', () => {
  it.each([
    {},
    { x: null },
    { localOffset: {} },
    { localOffset: { x: 1, y: 'h' } },
    { localOffset: { x: 1, y: Infinity } },
    { localOffset: { x: 1, y: 2, z: 3 } },
  ])('rejects empty/coerced/nonfinite point edits without source mutation (%j)', (patch) => {
    const source = line(0, 80),
      before = JSON.stringify(source)
    expect(() =>
      geometryCore.editGeometryDocument(source, {
        type: 'control-point',
        componentId: 'end',
        ...patch,
      })
    ).toThrow(TypeError)
    expect(JSON.stringify(source)).toBe(before)
  })
  it('keeps collapsed-arc reversal traversal instead of drawing only its coincident endpoints', () => {
    const source = line(100, 0)
    source.paths[0].width = 100
    source.paths[0].height = 80
    source.paths[0].commands = [
      { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
      { kind: 'arcTo', wR: 20, hR: 40, stAng: 5400000, swAng: 10800000 },
    ]
    const local = geometryCore.deriveGeometryPaths(source, { projectToLocal: true })
    expect(local.paths[0].d).toBe('M 0 0 L -20 0 L 0 0')
    expect(local.paths[0].transform).toEqual([1, 0, 0, 1, 0, 0])
  })
  it('edits one point axis without replacing the other authored guide reference', () => {
    const source = line(100, 80)
    const edited = geometryCore.editGeometryDocument(source, {
      type: 'control-point',
      componentId: 'end',
      x: 55,
    })
    expect(edited.paths[0].commands[1].points[0]).toEqual({
      componentId: 'end',
      x: 55,
      y: 'h',
    })
    expect(source.paths[0].commands[1].points[0]).toEqual({
      componentId: 'end',
      x: 'w',
      y: 'h',
    })
  })
  it('persists a shape-local displacement on a collapsed path axis without rewriting source coordinates', () => {
    const source = line(0, 80)
    source.paths[0].width = 100
    source.paths[0].height = 80
    source.paths[0].commands[1].points[0].x = 50
    const before = JSON.stringify(source)
    const edited = geometryCore.editGeometryDocument(source, {
      type: 'control-point',
      componentId: 'end',
      localOffset: { x: 12, y: 0 },
    })
    expect(edited.paths[0].commands[1].points[0]).toEqual({
      componentId: 'end',
      x: 50,
      y: 'h',
      localOffset: { x: 12, y: 0 },
    })
    expect(geometryCore.normalizeGeometryDocument(JSON.parse(JSON.stringify(edited)))).toEqual(
      edited
    )
    expect(edited.width).toBe(0)
    expect(JSON.stringify(source)).toBe(before)
    const local = geometryCore.deriveGeometryPaths(edited, { projectToLocal: true })
    expect(local.paths[0].d).toBe('M 0 0 L 12 80')
    expect(local.paths[0].transform).toEqual([1, 0, 0, 1, 0, 0])
    const svg = require('../../shared/src/pptx-geometry-svg.js').geometrySvgPathsString(edited, {
      width: 0,
      height: 80,
      fill: 'none',
      stroke: '#123456',
      strokeWidth: 2,
    })
    expect(svg).toContain('d="M 0 0 L 12 80"')
  })
  it.each([
    [0, 80, 0, 762000],
    [100, 0, 952500, 0],
  ])(
    'does not clip generated canonical geometry to its zero %i x %i wrapper bounds',
    (width, height, nativeWidth, nativeHeight) => {
      const element = {
        id: 'zero-leaf',
        type: 'shape',
        x: 20,
        y: 20,
        width,
        height,
        fill: '#ffffff',
        stroke: '#123456',
        strokeWidth: 2,
        pptxGeometry: line(nativeWidth, nativeHeight),
      }
      const markup = require('../../shared/src/element-renderers.js').renderSlideElements({
        id: 'zero-slide',
        elements: [element],
      })
      const wrapper = markup.slice(0, markup.indexOf('<svg'))
      expect(wrapper).toContain('overflow:visible;')
      expect(wrapper).not.toContain('overflow:hidden;')
    }
  )
  it.each([
    [0, 80, 0, 762000],
    [100, 0, 952500, 0],
  ])(
    'gives generated SVG a positive render-only viewport for %i x %i CSS geometry',
    (width, height, nativeWidth, nativeHeight) => {
      const element = {
        width,
        height,
        fill: '#ffffff',
        stroke: '#123456',
        strokeWidth: 2,
        pptxGeometry: line(nativeWidth, nativeHeight),
      }
      const before = JSON.stringify(element)
      const svg = require('../../shared/src/shapeUtils.js').shapeSvgString(element)
      expect(svg).toContain(`viewBox="0 0 ${Math.max(1, width)} ${Math.max(1, height)}"`)
      expect(svg).toContain(`width="${Math.max(1, width)}"`)
      expect(svg).toContain(`height="${Math.max(1, height)}"`)
      expect(svg).toContain('vector-effect="non-scaling-stroke"')
      expect(svg).not.toMatch(/NaN|Infinity/)
      expect(JSON.stringify(element)).toBe(before)
    }
  )
  it.each([
    [100, 0],
    [0, 80],
    [0, 0],
  ])('keeps %i x %i extents with omitted path grids', (width, height) => {
    const source = line(width, height)
    const normalized = geometryCore.normalizeGeometryDocument(source)
    expect(normalized).toEqual(source)
    const derived = geometryCore.deriveGeometryPaths(normalized)
    expect(derived.paths[0].transform).toEqual([1, 0, 0, 1, 0, 0])
    expect(derived.paths[0].d).toBe(`M 0 0 L ${width} ${height}`)
    expect(source.paths[0].width).toBeUndefined()
    expect(source.paths[0].height).toBeUndefined()
  })
  it('preserves a real explicit-grid collapse rather than treating it as omission', () => {
    const source = line(100, 0)
    source.paths[0].width = 100
    source.paths[0].height = 80
    source.paths[0].commands[1].points[0].y = 30
    const derived = geometryCore.deriveGeometryPaths(source)
    expect(derived.paths[0].transform).toEqual([1, 0, 0, 0, 0, 0])
    expect(transformPoint(derived.paths[0].transform, { x: 100, y: 30 })).toEqual({ x: 100, y: 0 })
    expect(source.height).toBe(0)
    expect(source.paths[0].commands[1].points[0].y).toBe(30)
  })
  it.each([
    [100, 0],
    [0, 80],
  ])('retains an invertible reflected/rotated %i x %i leaf inside a group', (cx, cy) => {
    const leaf = leafTransform({
      off: { x: 12, y: -7 },
      ext: { cx, cy },
      rotation: 2700000,
      flipH: true,
    })
    const group = groupTransform({
      off: { x: 4, y: 6 },
      ext: { cx: 200, cy: 160 },
      chOff: { x: 0, y: 0 },
      chExt: { cx: 100, cy: 80 },
    })
    const world = multiply(group, leaf)
    const point = { x: 35, y: 18 }
    const recovered = transformPoint(invert(world), transformPoint(world, point))
    expect(recovered.x).toBeCloseTo(point.x, 9)
    expect(recovered.y).toBeCloseTo(point.y, 9)
  })
})
