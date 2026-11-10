import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const core = require('../../shared/src/pptx-geometry-document.js')
const template = () => ({
  schemaVersion: 2,
  componentId: 'geometry',
  kind: 'custom',
  adjustments: [{ name: 'adj', formula: 'val 25000' }],
  guides: [{ name: 'tip', formula: '*/ w adj 100000' }],
  handles: [{ componentId: 'handle', kind: 'xy', position: { x: 'tip', y: 'h' }, gdRefX: 'adj' }],
  connections: [{ componentId: 'site', angle: 'cd4', position: { x: 'tip', y: 'h' } }],
  textRect: { l: 0, t: 0, r: 'w', b: 'h' },
  paths: [
    {
      componentId: 'path',
      width: 100,
      height: 80,
      stroke: false,
      extrusionOk: false,
      commands: [
        { kind: 'moveTo', points: [{ componentId: 'start', x: 0, y: 0 }] },
        { kind: 'lnTo', points: [{ componentId: 'end', x: 'tip', y: 'h' }] },
        { kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd4', swAng: 'cd2' },
      ],
    },
  ],
})

describe('extent-free source geometry templates', () => {
  it('preserves native structure and unknown extent parameters without mutating or fabricating source dimensions', () => {
    const source = template(),
      before = structuredClone(source)
    const result = core.normalizeGeometryTemplate(source)
    expect(result).toEqual(before)
    expect(result).not.toHaveProperty('width')
    expect(result).not.toHaveProperty('height')
    expect(result).not.toHaveProperty('style')
    expect(result.paths[0]).toMatchObject({
      width: 100,
      height: 80,
      stroke: false,
      extrusionOk: false,
    })
    result.paths[0].commands[1].points[0].x = 'w'
    expect(source).toEqual(before)
    expect(core.normalizeGeometryTemplate(JSON.parse(JSON.stringify(source)))).toEqual(before)
  })
  it('compiles one template at both real extents while standalone render/edit APIs reject the template itself', () => {
    const source = core.normalizeGeometryTemplate(template()),
      before = structuredClone(source)
    for (const [width, expected] of [
      [952500, 238125],
      [1905000, 476250],
      [0, 0],
    ]) {
      const canonical = core.normalizeGeometryDocument({
        ...source,
        schemaVersion: 1,
        width,
        height: 762000,
      })
      expect(core.evaluateGeometryGuides(canonical).tip).toBe(expected)
      expect(core.deriveGeometryPaths(canonical).connections[0].position).toEqual({
        x: expected,
        y: 762000,
      })
      expect(canonical.paths).toEqual(source.paths)
    }
    expect(source).toEqual(before)
    expect(() => core.normalizeGeometryDocument(source)).toThrow()
    expect(() => core.deriveGeometryPaths(source)).toThrow()
    expect(() =>
      core.editGeometryDocument(source, { type: 'adjustment', name: 'adj', value: 50000 })
    ).toThrow()
  })
  it('keeps ordered guide redefinitions and checks every reference in a conditional branch', () => {
    const source = template()
    source.guides = [
      { name: 'tip', formula: 'val w' },
      { name: 'tip', formula: '+- tip 100 0' },
      { name: 'constant', formula: '?: 1 5 tip' },
    ]
    expect(core.normalizeGeometryTemplate(source)).toEqual(source)
    expect(
      core.evaluateGeometryGuides({ ...source, schemaVersion: 1, width: 0, height: 80 }).tip
    ).toBe(100)
    source.guides[2].formula = '?: 1 5 missing'
    expect(() => core.normalizeGeometryTemplate(source)).toThrow()
  })
  it('defers only extent-dependent arithmetic and retains numeric checks when compiled', () => {
    const source = template()
    source.guides = [
      { name: 'denominator', formula: '+- w 0 h' },
      { name: 'tip', formula: '*/ w h denominator' },
    ]
    expect(core.normalizeGeometryTemplate(source)).toEqual(source)
    expect(() =>
      core.normalizeGeometryDocument({ ...source, schemaVersion: 1, width: 200, height: 100 })
    ).not.toThrow()
    expect(() =>
      core.normalizeGeometryDocument({ ...source, schemaVersion: 1, width: 100, height: 100 })
    ).toThrow()
  })
  it('validates higher-order templates without extents and compiles only the real context scale', () => {
    const source = template()
    delete source.paths[0].width
    delete source.paths[0].height
    source.paths[0].commands.pop()
    source.guides = [
      { name: 'square', formula: '*/ w w 1' },
      { name: 'fourth', formula: '*/ square square 1' },
      { name: 'third', formula: '*/ fourth 1 w' },
      { name: 'tip', formula: '*/ third 1 square' },
    ]
    expect(core.normalizeGeometryTemplate(source)).toEqual(source)
    for (const width of [1000000, 2000000]) {
      const compiled = { ...source, schemaVersion: 1, width, height: 800000 }
      expect(core.evaluateGeometryGuides(compiled).fourth).toBe(width ** 4)
      expect(core.deriveGeometryPaths(compiled).connections[0].position.x).toBe(width)
      expect(core.normalizeGeometryDocument(JSON.parse(JSON.stringify(compiled)))).toEqual(compiled)
    }
    expect(() =>
      core.normalizeGeometryDocument({
        ...source,
        schemaVersion: 1,
        width: 0,
        height: 800000,
      })
    ).toThrow(/division by zero/)
  })
  it.each([
    '*/ 100000000 100000000 1',
    '*/ 10000000000000000 1 1000',
    '?: w 1 10000000000000000',
    '*/ w h 0',
  ])('rejects known bad arithmetic even with abstract extent operands: %s', (formula) => {
    const source = template()
    source.guides[0].formula = formula
    expect(() => core.normalizeGeometryTemplate(source)).toThrow()
  })
  it.each([
    (value) => {
      value.width = 1
    },
    (value) => {
      value.height = 0
    },
    (value) => {
      value.style = {}
    },
    (value) => {
      value.schemaVersion = 1
    },
    (value) => {
      value.extra = true
    },
    (value) => {
      value.guides[0].formula = 'val unknown'
    },
    (value) => {
      value.guides[0].formula = '*/ w adj'
    },
    (value) => {
      value.guides[0].formula = '*/ w adj 0'
    },
    (value) => {
      value.guides[0].formula = 'sqrt -1'
    },
    (value) => {
      value.guides[0].formula = 'val 10000000000000000'
    },
    (value) => {
      value.guides[0].formula = 'val later'
      value.guides.push({ name: 'later', formula: 'val tip' })
    },
    (value) => {
      value.guides[0].name = 'w'
    },
    (value) => {
      value.adjustments.push({ name: 'adj', formula: 'val 1' })
    },
    (value) => {
      value.guides[0].name = 'adj'
    },
    (value) => {
      value.paths[0].commands[1].points[0].componentId = 'start'
    },
    (value) => {
      value.paths[0].commands[2].wR = -1
    },
    (value) => {
      value.paths[0].commands[2].swAng = 21600001
    },
    (value) => {
      value.connections[0].position.x = 'missing'
    },
    (value) => {
      value.handles[0].gdRefX = 'missing'
    },
  ])('rejects malformed templates without changing input (%#)', (mutate) => {
    const source = template()
    mutate(source)
    const before = structuredClone(source)
    expect(typeof core.normalizeGeometryTemplate).toBe('function')
    expect(() => core.normalizeGeometryTemplate(source)).toThrow()
    expect(source).toEqual(before)
  })
})
