import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

const require = createRequire(import.meta.url)
const {
  normalizeGeometryDocument,
  geometryStrokePaint,
} = require('../../shared/src/pptx-geometry-document.js')
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg.js')

function geometry(color) {
  const source = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  source.style = {
    fill: { color: { kind: 'srgb', value: 'FFFFFF' } },
    stroke: { width: 38100, color },
  }
  return source
}

const transformed = () => ({
  kind: 'srgb',
  value: '2468AC',
  transforms: [
    { kind: 'tint', value: 50000 },
    { kind: 'alpha', value: 50000 },
    { kind: 'alphaMod', value: 50000 },
  ],
})

describe('ordered DrawingML stroke color transforms', () => {
  it('retains authored color and resolves the established shape-paint mode exactly once', () => {
    const source = geometry(transformed())
    const before = structuredClone(source)
    const normalized = normalizeGeometryDocument(source)
    expect(normalized.style.stroke.color).toEqual(before.style.stroke.color)
    expect(geometryStrokePaint(normalized)).toEqual({
      stroke: '#BDC7DB',
      strokeWidth: 4,
      strokeOpacity: 0.25,
    })
    expect(source).toEqual(before)
  })

  it('paints stroke alpha separately from fill alpha and includes filled line ends', () => {
    const source = geometry(transformed())
    source.paths[0].commands.pop()
    source.style.stroke.tailEnd = { type: 'triangle', w: 'med', len: 'med' }
    const svg = geometrySvgPathsString(source, {
      width: 100,
      height: 80,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 0,
    })
    const stroke = svg.match(/<path data-pptx-geometry-path="path"[^>]*>/)?.[0]
    expect(stroke).toContain('stroke:#BDC7DB')
    expect(stroke).toContain('stroke-opacity="0.25"')
    expect(stroke).not.toContain('fill-opacity="0.25"')
    const end = svg.match(/<g data-pptx-line-end="tailEnd"[^>]*>/)?.[0]
    expect(end).toContain('opacity="0.25"')
  })

  it('keeps untransformed source strokes and explicit noFill output unchanged', () => {
    expect(geometryStrokePaint(geometry({ kind: 'srgb', value: '2468AC' }))).toEqual({
      stroke: '#2468AC',
      strokeWidth: 4,
    })
    expect(geometryStrokePaint(geometry({ kind: 'none' }))).toEqual({
      stroke: 'none',
      strokeWidth: 4,
    })
  })

  it.each([
    { kind: 'srgb', value: '2468AC', transforms: [{ kind: 'unknown', value: 50000 }] },
    { kind: 'srgb', value: '2468AC', transforms: [{ kind: 'alpha', value: 100001 }] },
    { kind: 'srgb', value: '2468AC', transforms: [{ kind: 'tint', value: -1 }] },
    { kind: 'srgb', value: '2468AC', transforms: [{ kind: 'alphaMod', value: 0.5 }] },
    { kind: 'srgb', value: 'not-rgb', transforms: [] },
  ])('rejects malformed transforms without changing the source', (color) => {
    const source = geometry(color)
    const before = structuredClone(source)
    expect(() => normalizeGeometryDocument(source)).toThrow()
    expect(source).toEqual(before)
  })
})
