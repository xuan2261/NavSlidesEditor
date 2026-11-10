import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { extentSourceGeometry as sourceGeometry } from './geometry-extent-fixture.js'

const require = createRequire(import.meta.url)
const {
  deriveGeometryPaths,
  editGeometryDocument,
  normalizeGeometryDocument,
} = require('../../shared/src/pptx-geometry-document.js')

describe('native geometry extent edits', () => {
  it('re-evaluates dimension guides without scaling literal coordinates on an omitted grid', () => {
    const source = sourceGeometry(952500, 762000)
    delete source.paths[0].width
    delete source.paths[0].height
    source.guides = [{ name: 'halfWidth', formula: '*/ w 1 2' }]
    source.paths[0].commands[1].points[0].y = 'halfWidth'
    const before = structuredClone(source)
    const changed = editGeometryDocument(source, { type: 'extent', width: 1905000 })
    expect(changed.paths).toEqual(before.paths)
    expect(changed.guides).toEqual(before.guides)
    expect(
      deriveGeometryPaths(changed, { projectToLocal: true }).paths[0].segments[1].points[1]
    ).toEqual({ x: 100, y: 952500 })
    expect(source).toEqual(before)
  })

  it('rejects an extent that makes a valid authored guide divide by zero atomically', () => {
    const source = sourceGeometry(952500, 762000)
    source.guides = [{ name: 'aspect', formula: '*/ w 1 h' }]
    normalizeGeometryDocument(source)
    const before = structuredClone(source)
    expect(() => editGeometryDocument(source, { type: 'extent', height: 0 })).toThrow(TypeError)
    expect(source).toEqual(before)
  })

  it('does not invoke accessor fields in an extent command', () => {
    const source = sourceGeometry(0, 762000)
    const before = structuredClone(source)
    let reads = 0
    const command = { type: 'extent' }
    Object.defineProperty(command, 'width', {
      enumerable: true,
      get() {
        reads++
        return 952500
      },
    })
    expect(() => editGeometryDocument(source, command)).toThrow(TypeError)
    expect(reads).toBe(0)
    expect(source).toEqual(before)
  })

  it.each([
    [0, 762000, { width: 952500.25 }, 952500.25, 762000],
    [952500, 0, { height: 762000.5 }, 952500, 762000.5],
    [952500, 762000, { width: 0 }, 0, 762000],
    [952500, 762000, { height: 0 }, 952500, 0],
    [0, 0, { width: 952500, height: 762000 }, 952500, 762000],
  ])(
    'changes the %s by %s native extent without rewriting the authored path grid',
    (width, height, patch, nextWidth, nextHeight) => {
      const source = sourceGeometry(width, height)
      const before = structuredClone(source)
      const changed = editGeometryDocument(source, { type: 'extent', ...patch })
      expect(changed.width).toBe(nextWidth)
      expect(changed.height).toBe(nextHeight)
      expect(changed.paths).toEqual(before.paths)
      expect(changed.connections).toEqual(before.connections)
      expect(changed.textRect).toEqual(before.textRect)
      const derived = deriveGeometryPaths(changed, { projectToLocal: true })
      expect(derived.paths[0].segments.at(-1).points.at(-1)).toEqual({
        x: nextWidth,
        y: nextHeight,
      })
      expect(derived.connections[0].position).toEqual({ x: nextWidth, y: nextHeight })
      expect(derived.textRect).toEqual({ l: 0, t: 0, r: nextWidth, b: nextHeight })
      expect(normalizeGeometryDocument(JSON.parse(JSON.stringify(changed)))).toEqual(changed)
      expect(source).toEqual(before)
    }
  )

  it.each([
    {},
    { width: -1 },
    { height: -1 },
    { width: '952500' },
    { height: null },
    { width: Infinity },
    { width: 1e12 + 1 },
    { width: 100, source: true },
  ])('rejects an invalid extent patch without partial mutation (%j)', (patch) => {
    const source = sourceGeometry(0, 762000)
    const before = structuredClone(source)
    expect(() => editGeometryDocument(source, { type: 'extent', ...patch })).toThrow(TypeError)
    expect(source).toEqual(before)
  })
})
