import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { arcGeometryFixture } from './geometry-arc-fixture.js'

const require = createRequire(import.meta.url)
const {
  deriveGeometryPaths,
  editGeometryDocument,
  normalizeGeometryDocument,
} = require('../../shared/src/pptx-geometry-document.js')

const edit = (input, parameter, value, patch = {}) =>
  editGeometryDocument(input, {
    type: 'arc-parameter',
    pathId: input.paths[0].componentId,
    commandIndex: 1,
    parameter,
    value,
    ...patch,
  })

describe('authored arc parameter edits', () => {
  it.each([
    ['wR', 30.25, [30.25, 40], [69.75, 80]],
    ['hR', 20.5, [50, 20.5], [50, 60.5]],
    ['stAng', 5400000, [50, 40], [50, 0]],
    ['swAng', -5400000, [50, 40], [50, 0]],
  ])('edits %s in the native grid and derives the changed arc', (parameter, value, radii, end) => {
    const input = arcGeometryFixture()
    const before = structuredClone(input)
    const changed = edit(input, parameter, value)
    const segment = deriveGeometryPaths(changed).paths[0].segments[1]
    expect(changed.paths[0].commands[1]).toEqual({
      ...before.paths[0].commands[1],
      [parameter]: value,
    })
    expect(segment.radii).toEqual(radii)
    expect(segment.points.at(-1).x).toBeCloseTo(end[0], 10)
    expect(segment.points.at(-1).y).toBeCloseTo(end[1], 10)
    expect(changed.paths[0].commands[2]).toEqual(before.paths[0].commands[2])
    expect(changed.paths[1]).toEqual(before.paths[1])
    expect(changed.guides).toEqual(before.guides)
    expect(normalizeGeometryDocument(JSON.parse(JSON.stringify(changed)))).toEqual(changed)
    expect(input).toEqual(before)
  })

  it('distinguishes equal command indices on different authored paths', () => {
    const input = arcGeometryFixture()
    const changed = edit(input, 'hR', 0, { pathId: input.paths[1].componentId })
    expect(changed.paths[0]).toEqual(input.paths[0])
    expect(changed.paths[1].commands[1].hR).toBe(0)
    expect(deriveGeometryPaths(changed).paths[1].segments).toHaveLength(1)
    expect(changed.paths[1].commands[1].swAng).toBe('-5400000')
  })

  it.each([
    ['unknown path', { pathId: 'missing' }],
    ['non-arc command', { commandIndex: 0 }],
    ['negative index', { commandIndex: -1 }],
    ['fractional index', { commandIndex: 1.5 }],
    ['missing index', { commandIndex: 20 }],
    ['unknown field', { parameter: 'x' }],
    ['non-numeric value', { value: '30' }],
    ['negative radius', { value: -1 }],
    ['excess radius', { value: 1e12 + 1 }],
    ['excess sweep', { parameter: 'swAng', value: 21600001 }],
    ['unexpected field', { source: true }],
  ])('rejects %s without changing authored input', (_name, patch) => {
    const input = arcGeometryFixture()
    const before = structuredClone(input)
    expect(() => edit(input, 'wR', 30, patch)).toThrow(TypeError)
    expect(input).toEqual(before)
  })
})
