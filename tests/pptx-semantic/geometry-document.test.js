import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { leafTransform, transformPoint } from '../../shared/src/pptx-affine'

const require = createRequire(import.meta.url)
const core = () => require('../../shared/src/pptx-geometry-document.js')

describe('native single centered stroke fields', () => {
  it('retains the authored fields through canonical normalization', () => {
    const source = geometry()
    source.style.stroke = {
      color: { kind: 'srgb', value: '445566' },
      width: 12700,
      compound: 'sng',
      alignment: 'ctr',
    }
    const before = structuredClone(source)
    expect(
      core().normalizeGeometryDocument(JSON.parse(JSON.stringify(source))).style.stroke
    ).toEqual(source.style.stroke)
    expect(source).toEqual(before)
  })
  it.each([
    ['compound', 'dbl'],
    ['compound', 'thickThin'],
    ['compound', 'invalid'],
    ['compound', 0],
    ['alignment', 'in'],
    ['alignment', 'invalid'],
    ['alignment', 0],
  ])('does not silently paint unsupported %s=%s with SVG defaults', (field, value) => {
    const source = geometry()
    source.style.stroke = { color: { kind: 'srgb', value: '445566' }, width: 12700, [field]: value }
    const before = structuredClone(source)
    expect(() => core().normalizeGeometryDocument(source)).toThrow(
      /stroke compound|stroke alignment/
    )
    expect(source).toEqual(before)
  })
})

function geometry() {
  return {
    schemaVersion: 1,
    componentId: 'geom',
    kind: 'custom',
    width: 100,
    height: 80,
    adjustments: [{ name: 'adj', formula: 'val 25000' }],
    guides: [{ name: 'tip', formula: '*/ w adj 100000' }],
    handles: [
      {
        componentId: 'handle',
        kind: 'xy',
        position: { x: 'tip', y: 0 },
        gdRefX: 'adj',
        minX: 0,
        maxX: 100000,
      },
    ],
    connections: [{ componentId: 'site', angle: 0, position: { x: 'tip', y: 'h' } }],
    textRect: { l: 0, t: 0, r: 'w', b: 'h' },
    connector: { start: { shapeId: '501', index: 0 }, end: { shapeId: '502', index: 2 } },
    style: {
      fill: { kind: 'scheme', value: 'accent1' },
      stroke: { width: 12700, dash: 'dash', head: 'triangle', tail: 'none' },
      effects: [{ kind: 'outerShadow', blur: 40000 }],
    },
    paths: [
      {
        componentId: 'path',
        width: 100,
        height: 80,
        fill: 'norm',
        stroke: true,
        extrusionOk: false,
        commands: [
          { kind: 'moveTo', points: [{ componentId: 'p0', x: 0, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: 'p1', x: 'tip', y: 10 }] },
          {
            kind: 'quadBezTo',
            points: [
              { componentId: 'q1', x: 40, y: 12 },
              { componentId: 'q2', x: 50, y: 30 },
            ],
          },
          {
            kind: 'cubicBezTo',
            points: [
              { componentId: 'c1', x: 55, y: 35 },
              { componentId: 'c2', x: 60, y: 50 },
              { componentId: 'c3', x: 70, y: 60 },
            ],
          },
          { kind: 'close' },
        ],
      },
    ],
  }
}
describe('canonical DrawingML geometry', () => {
  function highOrder() {
    const input = geometry()
    input.width = 1000000
    input.height = 800000
    delete input.paths[0].width
    delete input.paths[0].height
    input.guides = [
      { name: 'square', formula: '*/ w w 1' },
      { name: 'halfSquare', formula: '*/ square 1 2' },
      { name: 'fourth', formula: '*/ square square 1' },
      { name: 'third', formula: '*/ fourth 1 w' },
      { name: 'tip', formula: '*/ third 1 square' },
    ]
    return input
  }
  it('admits bounded custom higher-order intermediates, recomputing their proof after JSON reload', () => {
    const input = highOrder(),
      before = structuredClone(input)
    for (const document of [input, { ...input, kind: 'preset', preset: 'circularArrow' }]) {
      const canonical = core().normalizeGeometryDocument(document)
      expect(core().evaluateGeometryGuides(canonical)).toMatchObject({
        square: 1e12,
        fourth: 1e24,
        third: 1e18,
        tip: 1e6,
      })
      expect(core().deriveGeometryPaths(canonical).paths[0].d).toContain('L 1000000 10')
      const reloaded = core().normalizeGeometryDocument(JSON.parse(JSON.stringify(canonical)))
      expect(reloaded).toEqual(canonical)
      expect(core().deriveGeometryPaths(reloaded)).toEqual(core().deriveGeometryPaths(canonical))
    }
    expect(input).toEqual(before)
  })
  it('retains the inclusive ordinary and degree-two envelope boundaries', () => {
    const input = highOrder()
    input.guides = [{ name: 'tip', formula: 'val 1000000000000000' }]
    expect(core().evaluateGeometryGuides(input).tip).toBe(1e15)
    input.guides = [
      { name: 'square', formula: '*/ w w 1' },
      { name: 'boundedSquare', formula: '*/ square 1000000000000000 1' },
      { name: 'tip', formula: 'val w' },
    ]
    expect(core().evaluateGeometryGuides(input).boundedSquare).toBe(1e27)
  })
  it.each(
    [
      ['val 10000000000000000'],
      ['*/ 100000000 100000000 1'],
      ['*/ 10000000000000000 1 1000'],
      ['?: 1 1 10000000000000000'],
      ['*/ square 1000000000000000 .5'],
      ['*/ square 1000000000000000 halfSquare'],
      ['*/ square 1000000000000000 w'],
      ['+- w 100 0', '*/ result result 1', '*/ result result 1'],
      ['?: 1 fourth square'],
      ['sqrt third', '*/ result result 1'],
      ['*/ fourth w 1'],
      ['+- w 100 0', '*/ result square 1'],
      ['val 1', '?: 1 w fourth', '*/ result w 1', '*/ result result 1'],
    ].map((formulas) => ({ formulas }))
  )(
    'does not grant magnitude privileges to constants, mixed or unproved expressions: %j',
    ({ formulas }) => {
      const input = highOrder()
      input.guides.push(...formulas.map((formula) => ({ name: 'result', formula })))
      const before = structuredClone(input)
      expect(() => core().normalizeGeometryDocument(input)).toThrow()
      expect(() => core().normalizeGeometryDocument(JSON.parse(JSON.stringify(input)))).toThrow()
      expect(input).toEqual(before)
    }
  )
  it.each([
    'point',
    'control',
    'site',
    'angle',
    'handle',
    'limit',
    'rectangle',
    'arcAngle',
    'arcRadius',
  ])('never admits a higher-order value as a geometric consumer: %s', (sink) => {
    const input = highOrder()
    if (sink === 'point') input.paths[0].commands[1].points[0].x = 'fourth'
    if (sink === 'control') input.paths[0].commands[2].points[0].x = 'fourth'
    if (sink === 'site') input.connections[0].position.x = 'fourth'
    if (sink === 'angle') input.connections[0].angle = 'fourth'
    if (sink === 'handle') input.handles[0].position.x = 'fourth'
    if (sink === 'limit') input.handles[0].maxX = 'fourth'
    if (sink === 'rectangle') input.textRect.r = 'fourth'
    if (sink === 'arcAngle' || sink === 'arcRadius')
      input.paths[0].commands.push({
        kind: 'arcTo',
        wR: sink === 'arcRadius' ? 'fourth' : 10,
        hR: 5,
        stAng: sink === 'arcAngle' ? 'fourth' : 0,
        swAng: 5400000,
      })
    expect(() => core().normalizeGeometryDocument(input)).toThrow()
  })
  it.each([1e16, '10000000000000000'])(
    'bounds direct numeric consumers without needing a guide: %s',
    (value) => {
      for (const sink of ['point', 'site', 'angle', 'handle', 'limit', 'rectangle', 'arc']) {
        const input = geometry()
        if (sink === 'point') input.paths[0].commands[0].points[0].x = value
        if (sink === 'site') input.connections[0].position.x = value
        if (sink === 'angle') input.connections[0].angle = value
        if (sink === 'handle') input.handles[0].position.x = value
        if (sink === 'limit') input.handles[0].maxX = value
        if (sink === 'rectangle') input.textRect.r = value
        if (sink === 'arc')
          input.paths[0].commands.push({
            kind: 'arcTo',
            wR: 10,
            hR: 5,
            stAng: value,
            swAng: 5400000,
          })
        expect(() => core().normalizeGeometryDocument(input)).toThrow()
      }
    }
  )
  it('bounds path-grid composition, point offsets and synthesized arc centers/endpoints', () => {
    const point = geometry().paths[0].commands[0].points[0]
    for (const localOffset of [
      { x: 1e16, y: 0 },
      { x: 1e15, y: 0 },
    ]) {
      const input = geometry()
      input.paths[0].commands = [{ kind: 'moveTo', points: [{ ...point, x: 1, localOffset }] }]
      expect(() => core().normalizeGeometryDocument(input)).toThrow()
    }
    const scaled = geometry()
    scaled.paths[0].width = 1
    scaled.paths[0].commands[0].points[0].x = 1e15
    expect(() => core().normalizeGeometryDocument(scaled)).toThrow()
    const arc = geometry()
    delete arc.paths[0].width
    delete arc.paths[0].height
    arc.paths[0].commands = [
      { kind: 'moveTo', points: [{ ...point, x: 1e15, y: 0 }] },
      { kind: 'arcTo', wR: 10, hR: 5, stAng: 10800000, swAng: 5400000 },
    ]
    expect(() => core().deriveGeometryPaths(arc)).toThrow()
    const gridArc = structuredClone(arc)
    gridArc.paths[0].width = 1
    gridArc.paths[0].commands[0].points[0].x = 1e13
    expect(() => core().normalizeGeometryDocument(gridArc)).not.toThrow()
    expect(() => core().deriveGeometryPaths(gridArc)).toThrow()
    expect(() => core().deriveGeometryPaths(gridArc, { projectToLocal: true })).toThrow()
  })
  it('updates ordered degree metadata without treating an extent-dependent zero as a constant', () => {
    const input = highOrder()
    input.guides.push(
      { name: 'square', formula: '+- w 100 0' },
      { name: 'result', formula: '*/ square square 1' },
      { name: 'result', formula: '*/ result result 1' }
    )
    expect(() => core().normalizeGeometryDocument(input)).toThrow()
    const zero = highOrder()
    zero.guides.push(
      { name: 'zeroAtThisExtent', formula: '+- w 0 w' },
      { name: 'mixed', formula: '+- fourth zeroAtThisExtent 0' }
    )
    expect(() => core().normalizeGeometryDocument(zero)).toThrow()
    for (const extra of [{ degree: 4 }, { trusted: true }])
      expect(() => core().normalizeGeometryDocument({ ...highOrder(), ...extra })).toThrow()
  })
  it('edits and removes a typed native shadow without changing source or other paints', () => {
    const source = geometry()
    const before = structuredClone(source)
    const shadow = {
      kind: 'outerShdw',
      color: {
        kind: 'srgb',
        value: '2468AC',
        transforms: [{ kind: 'alpha', value: 50000 }],
      },
      blurRad: 0,
      dist: 152400,
      sx: -50000,
      rotWithShape: false,
    }
    const changed = core().editGeometryDocument(source, { type: 'outer-shadow', shadow })
    expect(changed.style.effects).toEqual({ kind: 'list', effects: [shadow] })
    expect(changed.style.fill).toEqual(before.style.fill)
    expect(changed.style.stroke).toEqual(before.style.stroke)
    expect(source).toEqual(before)
    const cleared = core().editGeometryDocument(changed, { type: 'outer-shadow', shadow: null })
    expect(cleared.style.effects).toEqual({ kind: 'list', effects: [] })
    expect(cleared.style.fill).toEqual(changed.style.fill)
    expect(cleared.style.stroke).toEqual(changed.style.stroke)
    expect(changed.style.effects.effects).toHaveLength(1)
  })
  it.each([
    { shadow: { kind: 'outerShdw', color: { kind: 'srgb', value: '123456' }, blurRad: -1 } },
    {
      shadow: {
        kind: 'outerShdw',
        color: { kind: 'srgb', value: '123456' },
        rotWithShape: 'false',
      },
    },
    { shadow: { kind: 'outerShdw', color: { kind: 'srgb', value: '123456' } }, extra: true },
    {},
  ])('rejects invalid native-shadow commands atomically: %j', (command) => {
    const source = geometry()
    const before = structuredClone(source)
    expect(() =>
      core().editGeometryDocument(source, { type: 'outer-shadow', ...command })
    ).toThrow()
    expect(source).toEqual(before)
  })
  it('edits typed occurrence stroke paint without mutating native baseline metadata', () => {
    const source = geometry()
    const before = JSON.stringify(source)
    const changed = core().editGeometryDocument(source, {
      type: 'stroke-paint',
      color: { kind: 'srgb', value: '2468AC' },
      width: 38100,
    })
    expect(changed.style.stroke).toMatchObject({
      color: { kind: 'srgb', value: '2468AC' },
      width: 38100,
      dash: 'dash',
    })
    expect(JSON.stringify(source)).toBe(before)
    for (const color of [
      { kind: 'srgb', value: 'url(evil)' },
      { kind: 'srgb', value: 123456 },
      { kind: 'unknown', value: '2468AC' },
    ])
      expect(() =>
        core().editGeometryDocument(source, { type: 'stroke-paint', color, width: 38100 })
      ).toThrow()
    for (const width of [-1, '38100', Infinity])
      expect(() =>
        core().editGeometryDocument(source, {
          type: 'stroke-paint',
          color: { kind: 'srgb', value: '2468AC' },
          width,
        })
      ).toThrow()
  })
  it('retains native formulas, handles, connections, path paints and connector style without aliasing', () => {
    const input = geometry()
    const output = core().normalizeGeometryDocument(input)
    expect(output).toEqual(input)
    expect(JSON.parse(JSON.stringify(output))).toEqual(input)
    output.connector.start.shapeId = 'other'
    output.paths[0].commands[0].points[0].x = 999
    expect(input.connector.start.shapeId).toBe('501')
    expect(input.paths[0].commands[0].points[0].x).toBe(0)
    const derived = core().deriveGeometryPaths(input)
    expect(derived.paths[0]).toMatchObject({
      d: 'M 0 0 L 25 10 Q 40 12 50 30 C 55 35 60 50 70 60 Z',
      fill: 'norm',
      stroke: true,
      extrusionOk: false,
    })
    expect(derived.handles[0].position).toEqual({ x: 25, y: 0 })
    expect(derived.connections[0].position).toEqual({ x: 25, y: 80 })
    expect(derived.connector).toEqual(input.connector)
    expect(derived.style).toEqual(input.style)
  })
  it('edits an asymmetric reflected control point in local coordinates and preserves source', () => {
    const input = geometry(),
      snapshot = JSON.stringify(input)
    const transform = leafTransform({
      off: { x: -10, y: 20 },
      ext: { cx: 100, cy: 80 },
      flipH: true,
    })
    const changed = core().editGeometryDocument(input, {
      type: 'control-point',
      componentId: 'c1',
      x: 58,
      y: 37,
    })
    const result = core().deriveGeometryPaths(changed, { transform })
    expect(result.paths[0].d).toContain('C 58 37 60 50 70 60')
    expect(transformPoint(result.paths[0].transform, { x: 58, y: 37 })).toEqual({ x: 32, y: 57 })
    expect(JSON.stringify(input)).toBe(snapshot)
  })
  it('retains supplied preset paths and changes authored adjustment formulas, never generic substitutes', () => {
    const input = { ...geometry(), kind: 'preset', preset: 'roundRect' }
    const changed = core().editGeometryDocument(input, {
      type: 'adjustment',
      name: 'adj',
      value: 40000,
    })
    expect(changed.preset).toBe('roundRect')
    expect(core().deriveGeometryPaths(changed).paths[0].d).toContain('L 40 10')
    expect(input.adjustments[0].formula).toBe('val 25000')
    expect(
      core().normalizeGeometryDocument({ ...input, preset: 'unresolvedPreset', paths: [] }).preset
    ).toBe('unresolvedPreset')
    expect(() => core().deriveGeometryPaths({ ...input, paths: [] })).toThrow(/authored paths/)
  })
  it('edits connector metadata without dropping the other endpoint or paints', () => {
    const input = geometry()
    const changed = core().editGeometryDocument(input, {
      type: 'connector',
      end: 'start',
      shapeId: '503',
      index: 1,
    })
    expect(changed.connector).toEqual({
      start: { shapeId: '503', index: 1 },
      end: input.connector.end,
    })
    expect(changed.style).toEqual(input.style)
    expect(input.connector.start.shapeId).toBe('501')
  })
  it.each([
    ['*/ 6 7 2', 21],
    ['+- 6 7 2', 11],
    ['+/ 6 8 2', 7],
    ['?: -1 7 9', 9],
    ['abs -3', 3],
    ['at2 0 1', 5400000],
    ['cat2 10 0 1', 0],
    ['sat2 10 0 1', 10],
    ['cos 10 10800000', -10],
    ['sin 10 5400000', 10],
    ['tan 10 2700000', 10],
    ['max 7 2', 7],
    ['min 7 2', 2],
    ['mod 2 3 6', 7],
    ['pin 1 20 10', 10],
    ['sqrt 81', 9],
    ['val wd2', 50],
    ['val 3cd4', 16200000],
    ['val ssd2', 40],
  ])('evaluates bounded DrawingML %s in native units', (formula, value) => {
    const input = geometry()
    input.guides = [{ name: 'result', formula }]
    input.paths[0].commands[1].points[0].x = 'result'
    input.handles = []
    input.connections = []
    expect(core().evaluateGeometryGuides(input).result).toBeCloseTo(value, 8)
  })
  it('derives elliptical arcTo from polar DrawingML angles, including full and negative sweeps', () => {
    const input = geometry()
    input.paths[0].commands = [
      { kind: 'moveTo', points: [{ componentId: 'arc-start', x: 40, y: 20 }] },
      { kind: 'arcTo', wR: 30, hR: 10, stAng: 0, swAng: 21600000 },
      { kind: 'arcTo', wR: 30, hR: 10, stAng: 0, swAng: -5400000 },
    ]
    const result = core().deriveGeometryPaths(input, { transform: [1, 0, 0.5, -2, 3, 4] })
    expect(result.paths[0].d.match(/A 30 10 0 0 1/g)).toHaveLength(4)
    expect(result.paths[0].d).toContain('A 30 10 0 0 0')
    expect(result.paths[0].transform).toEqual([1, 0, 0.5, -2, 3, 4])
    input.paths[0].commands[1] = { kind: 'arcTo', wR: 30, hR: 10, stAng: 2700000, swAng: 2700000 }
    input.paths[0].commands.pop()
    const d = core().deriveGeometryPaths(input).paths[0].d
    const end = d.split(' ').slice(-2).map(Number)
    expect(end[0]).toBeCloseTo(40 - Math.sqrt(90), 8)
    expect(end[1]).toBeCloseTo(30 - Math.sqrt(90), 8)
  })
  it('scales per-path coordinate grids without modifying local path commands', () => {
    const input = geometry()
    input.width = 200
    input.height = 240
    const result = core().deriveGeometryPaths(input, { transform: [-1, 0, 0, 1, 200, 0] })
    expect(result.paths[0].transform).toEqual([-2, 0, 0, 3, 200, 0])
    expect(result.paths[0].d).toContain('L 50 10')
  })
  it.each([
    'eval 1',
    'val globalThis',
    'val constructor',
    '*/ 1 2 0',
    'sqrt -1',
    'val 1;globalThis.geometryExecuted=true',
    '+- 1 2',
    'val 1e309',
    'val later',
  ])('rejects malformed/unknown formula %s without mutation or execution', (formula) => {
    const input = geometry()
    input.guides[0].formula = formula
    const snapshot = JSON.stringify(input)
    expect(() => core().normalizeGeometryDocument(input)).toThrow(TypeError)
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(globalThis.geometryExecuted).toBeUndefined()
  })
  it.each([
    (d) => {
      d.adjustments.push({ name: 'adj', formula: 'val 1' })
    },
    (d) => {
      d.guides[0].name = 'w'
    },
    (d) => {
      d.paths[0].commands.shift()
    },
    (d) => {
      d.paths[0].commands[1].points[0].x = 'missing'
    },
    (d) => {
      d.paths[0].commands[2].points.pop()
    },
    (d) => {
      d.paths[0].fill = 'invented'
    },
    (d) => {
      d.width = -1
    },
    (d) => {
      d.height = -1
    },
    (d) => {
      d.paths[0].width = 0
    },
    (d) => {
      d.paths[0].height = 0
    },
    (d) => {
      d.paths[0].width = -1
    },
    (d) => {
      d.connector.start.index = -1
    },
    (d) => {
      d.handles[0].gdRefX = 'missing'
    },
    (d) => {
      d.paths[0].commands[1].points[0].componentId = 'geom'
    },
    (d) => {
      d.paths = Array(257).fill(d.paths[0])
    },
    (d) => {
      d.guides[0].formula = 'val ' + '1'.repeat(1024)
    },
  ])('rejects malformed geometry without partial mutation', (mutate) => {
    const input = geometry()
    mutate(input)
    const snapshot = JSON.stringify(input)
    expect(() => core().normalizeGeometryDocument(input)).toThrow(TypeError)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
  it('rejects JSON accessors, cycles, sparse arrays, forbidden keys and invalid edits atomically', () => {
    let reads = 0
    const input = geometry()
    Object.defineProperty(input, 'guides', {
      enumerable: true,
      get() {
        reads++
        return []
      },
    })
    expect(() => core().normalizeGeometryDocument(input)).toThrow(TypeError)
    expect(reads).toBe(0)
    const cycle = geometry()
    cycle.style = cycle
    expect(() => core().normalizeGeometryDocument(cycle)).toThrow(TypeError)
    const sparse = geometry()
    delete sparse.paths[0].commands[1]
    expect(() => core().normalizeGeometryDocument(sparse)).toThrow(TypeError)
    expect(() => core().normalizeGeometryDocument(JSON.parse('{"__proto__":{}}'))).toThrow(
      TypeError
    )
    const source = geometry(),
      snapshot = JSON.stringify(source)
    expect(() =>
      core().editGeometryDocument(source, {
        type: 'control-point',
        componentId: 'c1',
        x: 'malicious',
        y: 5,
      })
    ).toThrow(TypeError)
    expect(() =>
      core().editGeometryDocument(source, { type: 'adjustment', name: 'missing', value: 5 })
    ).toThrow(TypeError)
    expect(JSON.stringify(source)).toBe(snapshot)
  })
})
