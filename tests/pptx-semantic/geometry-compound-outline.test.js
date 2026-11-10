import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { geometryProjectionFixture } from './geometry-projection-fixture'

const require = createRequire(import.meta.url)
const {
  normalizeGeometryDocument,
  deriveGeometryPaths,
  geometryStrokePaint,
} = require('../../shared/src/pptx-geometry-document')
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg')
const { deriveNativeOutline } = require('../../shared/src/pptx-geometry-outline')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')
const { shapeSvgString } = require('../../shared/src/shapeUtils')
const {
  parseXml,
  descendants,
  attr,
} = require('../../server/services/pptx-import/ooxml-text-run-xml')

function curvedDeck() {
  const deck = geometryProjectionFixture()
  const geometry = deck.pptxSemantic.definitions.definition.content.geometry
  geometry.width = 952500
  geometry.height = 762000
  geometry.adjustments = []
  geometry.guides = []
  geometry.handles = []
  geometry.paths[0].commands.pop()
  geometry.paths[0].commands[1].points = [
    { componentId: 'control', x: 0, y: 762000 },
    { componentId: 'second', x: 952500, y: 762000 },
    { componentId: 'end', x: 952500, y: 0 },
  ]
  geometry.style = {
    fill: { color: { kind: 'none' } },
    stroke: {
      color: { kind: 'srgb', value: '123456' },
      width: 38100,
      compound: 'dbl',
      alignment: 'ctr',
      cap: 'flat',
      dash: { kind: 'preset', value: 'solid' },
      join: { kind: 'miter', limit: 800000 },
    },
  }
  return deck
}
function curvedFootprint(geometry, maxScale) {
  const path = deriveGeometryPaths(geometry, {
    transform: [1, 0, 0, 1, 0, 0],
    projectToLocal: true,
    localScale: [1 / 9525, 1 / 9525],
  }).paths[0]
  return deriveNativeOutline(path, geometry.style.stroke, 4, { maxScale })
}
function renderedOutline(svg) {
  return descendants({ children: parseXml(svg) }, (node) =>
    node.attrs?.some((entry) => entry.name === 'data-pptx-geometry-path')
  )[0]
}

describe('native compound and alignment outline documents', () => {
  it('rejects a signed-zero guide reversal after warming a positive-zero outline proof', () => {
    const source = curvedDeck().pptxSemantic.definitions.definition.content.geometry
    source.width = 0
    source.guides = [{ name: 'endX', formula: 'cat2 952500 w 0' }]
    source.paths[0].commands = [
      { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
      { kind: 'lnTo', points: [{ componentId: 'turn', x: 952500, y: 0 }] },
      { kind: 'lnTo', points: [{ componentId: 'end', x: 'endX', y: 0 }] },
    ]
    expect(normalizeGeometryDocument(source)).toEqual(source)
    source.width = -0
    expect(() => normalizeGeometryDocument(source)).toThrow(/Unsupported native outline/)
    expect(Object.is(source.width, -0)).toBe(true)
  })
  it('keeps repeated outline reads independent and rejects an in-place reversal after a valid read', () => {
    const source = curvedDeck().pptxSemantic.definitions.definition.content.geometry
    const before = structuredClone(source)
    const first = normalizeGeometryDocument(source)
    first.paths[0].commands[1].points[0].x = 500000
    first.style.stroke.width = 1
    expect(normalizeGeometryDocument(source)).toEqual(before)
    expect(source).toEqual(before)
    source.paths[0].commands = [
      { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
      { kind: 'lnTo', points: [{ componentId: 'turn', x: 952500, y: 0 }] },
      { kind: 'lnTo', points: [{ componentId: 'end', x: 0, y: 0 }] },
    ]
    const invalid = structuredClone(source)
    expect(() => normalizeGeometryDocument(source)).toThrow(/Unsupported native outline/)
    expect(() => normalizeGeometryDocument(JSON.parse(JSON.stringify(source)))).toThrow(/Unsupported native outline/)
    expect(source).toEqual(invalid)
  })
  it.each(
    ['ctr', 'in'].flatMap((alignment) =>
      ['sng', 'dbl', 'thinThick', 'thickThin', 'tri'].map((compound) => [compound, alignment])
    )
  )(
    'retains %s/%s native intent and canonical component coordinates through JSON reload',
    (compound, alignment) => {
      const source = {
        schemaVersion: 1,
        componentId: 'native-outline',
        kind: 'custom',
        width: 7620000,
        height: 0,
        adjustments: [],
        guides: [],
        handles: [],
        connections: [],
        paths: [
          {
            componentId: 'native-line',
            fill: 'none',
            stroke: true,
            commands: [
              { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
              { kind: 'lnTo', points: [{ componentId: 'end', x: 7620000, y: 0 }] },
            ],
          },
        ],
        style: {
          fill: { color: { kind: 'none' } },
          stroke: {
            color: { kind: 'srgb', value: '000000' },
            width: 381000,
            cap: 'flat',
            compound,
            alignment,
            dash: { kind: 'preset', value: 'solid' },
            join: { kind: 'miter', limit: 800000 },
          },
        },
      }
      const before = structuredClone(source)
      const normalized = normalizeGeometryDocument(source)
      expect(normalized.style.stroke).toEqual(source.style.stroke)
      expect(normalizeGeometryDocument(JSON.parse(JSON.stringify(normalized)))).toEqual(normalized)
      expect(geometryStrokePaint(normalized)).toMatchObject({ stroke: '#000000', strokeWidth: 40 })
      const structural = structuredClone(normalized)
      delete structural.style
      expect(deriveGeometryPaths(normalized).paths[0].segments).toEqual(
        deriveGeometryPaths(structural).paths[0].segments
      )
      const svg = geometrySvgPathsString(normalized, {
        width: 800,
        height: 0,
        fill: 'none',
        stroke: '#000000',
        strokeWidth: 40,
      })
      expect(svg).toContain('data-pptx-geometry-path="native-line"')
      const rendered = descendants({ children: parseXml(svg) }, (node) =>
        node.attrs?.some((entry) => entry.name === 'data-pptx-geometry-path')
      )[0]
      const paint = Object.fromEntries(
        attr(rendered, 'style')
          .split(';')
          .filter(Boolean)
          .map((field) => field.split(':'))
      )
      if (compound === 'sng' && alignment === 'ctr') {
        expect(paint).toEqual({ fill: 'none', stroke: '#000000' })
        expect(Number(attr(rendered, 'stroke-width'))).toBe(40)
      } else {
        expect(paint).toEqual({ fill: '#000000', stroke: 'none' })
        expect(attr(rendered, 'fill-rule')).toBe('nonzero')
        const contours = attr(rendered, 'd')
          .split('Z')
          .filter((part) => part.trim())
          .map((part) =>
            [...part.matchAll(/[ML]\s+(-?[\d.e+-]+)\s+(-?[\d.e+-]+)/g)].map((match) => ({
              x: Number(match[1]),
              y: Number(match[2]),
            }))
          )
        const points = contours.flat()
        expect(Math.min(...points.map((point) => point.x))).toBe(0)
        expect(Math.max(...points.map((point) => point.x))).toBe(800)
        expect(Math.min(...points.map((point) => point.y))).toBe(alignment === 'in' ? 0 : -20)
        expect(Math.max(...points.map((point) => point.y))).toBe(alignment === 'in' ? 40 : 20)
        const area = contours.reduce(
          (sum, contour) =>
            sum +
            contour.reduce((cross, point, index) => {
              const next = contour[(index + 1) % contour.length]
              return cross + point.x * next.y - next.x * point.y
            }, 0) /
              2,
          0
        )
        const paintedRatio = { sng: 1, dbl: 2 / 3, thinThick: 0.8, thickThin: 0.8, tri: 2 / 3 }[
          compound
        ]
        expect(Math.abs(area)).toBeCloseTo(800 * 40 * paintedRatio, 2)
      }
      expect(source).toEqual(before)
    }
  )

  it.each([
    [[2, 0, 0, 1, 952500, -19050], 1.5, 3],
    [[2, 0, 3, 2, 0, 0], 1, 4],
    [[-2, 0, 0, 1, 0, 0], 2, 4],
    [[4, 0, 0, 4, 0, 0], 0.25, 1],
    [[0.25, 0, 0, 0.25, 0, 0], 8, 2],
    [undefined, 3, 3],
    [undefined, undefined, 1],
    [[0, 1, -1, 0, 952500, -19050], 1, 1],
    [[-1, 0, 0, 1, 0, 0], 1, 1],
  ])(
    'refines real curved outlines for occurrence %j at output scale %s',
    (occurrenceMatrix, outputPixelScale, maxScale) => {
      const deck = curvedDeck()
      const geometry = deck.pptxSemantic.definitions.definition.content.geometry
      const before = structuredClone(deck)
      const expected = curvedFootprint(geometry, maxScale)
      if (maxScale > 1) expect(expected.d).not.toBe(curvedFootprint(geometry, 1).d)
      const options = {
        width: 100,
        height: 80,
        fill: 'none',
        stroke: '#123456',
        strokeWidth: 4,
        occurrenceMatrix,
        outputPixelScale,
      }
      const rendered = renderedOutline(geometrySvgPathsString(geometry, options))
      expect(attr(rendered, 'd')).toBe(expected.d)
      expect(attr(rendered, 'transform')).toBe(`matrix(${expected.transform.join(' ')})`)
      if (occurrenceMatrix) {
        const translated = [...occurrenceMatrix.slice(0, 4), -1234567, 7654321]
        expect(geometrySvgPathsString(geometry, { ...options, occurrenceMatrix: translated })).toBe(
          geometrySvgPathsString(geometry, options)
        )
      }
      expect(deck).toEqual(before)
    }
  )

  it('carries composed solid compound transforms through the real tree and shared SVG caller', () => {
    const deck = curvedDeck()
    const model = deck.pptxSemantic
    model.definitions.group = {
      id: 'group',
      kind: 'group',
      source: { ...model.definitions.definition.source, nativeId: 'group' },
      components: [],
      content: {},
    }
    model.instances.group = {
      id: 'group',
      definitionId: 'group',
      parentInstanceId: null,
      slideId: 's1',
      localTransform: [-8, 1, 3, 5, 952500, -19050],
      paintIndex: 0,
      overrides: {},
    }
    model.instances.i1.parentInstanceId = 'group'
    model.instances.i1.localTransform = [0, 1, -1, 0, 0, 0]
    model.instances.i1.paintIndex = 1
    const before = structuredClone(deck)
    const node = semanticRenderTree(model, deck.slides[0])[0].children[0]
    expect(node.element.pptxOccurrenceMatrix).toEqual([3, 5, 8, -1, 952500, -19050])
    const maxScale = (Math.hypot(2, -3) + Math.hypot(4, 13)) / 2
    const expected = curvedFootprint(node.element.pptxGeometry, maxScale)
    expect(expected.d).not.toBe(curvedFootprint(node.element.pptxGeometry, 1).d)
    const rendered = renderedOutline(shapeSvgString(node.element))
    expect(attr(rendered, 'd')).toBe(expected.d)
    expect(attr(rendered, 'transform')).toBe(`matrix(${expected.transform.join(' ')})`)
    expect(deck).toEqual(before)
  })

  it.each([0, -1, NaN, Infinity, '2'])(
    'rejects an invalid explicit compound output pixel scale: %j',
    (outputPixelScale) => {
      const geometry = curvedDeck().pptxSemantic.definitions.definition.content.geometry
      const before = structuredClone(geometry)
      expect(() =>
        geometrySvgPathsString(geometry, {
          width: 100,
          height: 80,
          fill: 'none',
          stroke: '#123456',
          strokeWidth: 4,
          outputPixelScale,
        })
      ).toThrow()
      expect(geometry).toEqual(before)
    }
  )
})
