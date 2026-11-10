import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const core = () => require('../../shared/src/pptx-semantic-connectors.js')
function fixture() {
  const geometry = (componentId) => ({
    schemaVersion: 1,
    componentId,
    kind: 'custom',
    width: 100,
    height: 80,
    paths: [
      {
        componentId: `${componentId}-path`,
        commands: [
          { kind: 'moveTo', points: [{ componentId: `${componentId}-p0`, x: 0, y: 0 }] },
          { kind: 'lnTo', points: [{ componentId: `${componentId}-p1`, x: 100, y: 80 }] },
        ],
      },
    ],
  })
  const target = geometry('target-geometry')
  target.adjustments = [{ name: 'adj', formula: 'val 25' }]
  target.connections = [{ componentId: 'site', angle: 0, position: { x: 'adj', y: 'h' } }]
  // An explicit path grid must not scale native shape-local connection positions.
  target.paths[0].width = 1000
  target.paths[0].height = 800
  const connector = geometry('connector-geometry')
  connector.connector = {
    start: {
      shapeId: '2',
      index: 0,
      targetDefinitionId: 'target',
      componentId: 'start-connection',
    },
  }
  connector.paths[0].width = 1000
  connector.paths[0].height = 800
  const definition = (id, nativeId, geometry, kind = 'shape') => ({
    id,
    kind,
    source: { nativeId, partUri: 'ppt/slides/slide1.xml' },
    components: geometry
      ? [
          { id: geometry.componentId, kind: 'geometry' },
          ...(geometry.connector ? [{ id: 'start-connection', kind: 'connection' }] : []),
        ]
      : [],
    content: geometry ? { geometry } : {},
  })
  const instance = (id, definitionId, parentInstanceId, localTransform) => ({
    id,
    definitionId,
    parentInstanceId,
    localTransform,
    slideId: 'slide',
    relationshipChain: ['ppt/slides/slide1.xml'],
    overrides: {},
  })
  return {
    definitions: {
      connector: definition('connector', '1', connector),
      target: definition('target', '2', target),
      group: definition('group', '3', null, 'group'),
    },
    instances: {
      root: instance('root', 'group', null, [-2, 0.3, 0.4, 3, 50, -20]),
      left: instance('left', 'group', 'root', [1, 0.5, -0.2, 2, 10, 5]),
      right: instance('right', 'group', 'root', [-1, 0.2, 0.6, 0.8, -7, 40]),
      connector: {
        ...instance('connector', 'connector', 'left', [1, 0.1, 0.3, -1, 12, 6]),
        connectorBindings: { start: { targetInstanceId: 'target', index: 0 } },
      },
      target: instance('target', 'target', 'right', [0.8, 0.4, -0.1, 1.2, 30, -15]),
    },
  }
}
// Independent forward arithmetic: do not reuse the resolver's affine helpers.
function worldPoint(document, id, point) {
  while (id !== null) {
    const node = document.instances[id]
    const [a, b, c, d, e, f] = node.localTransform
    point = { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
    id = node.parentInstanceId
  }
  return point
}
function assertAttachment(document, expectedSite) {
  const derived = core().deriveConnectorGeometry(document, 'connector')
  const point = derived.paths[0].commands[0].points[0]
  const path = derived.paths[0]
  const local = {
    x:
      point.x * (path.width === undefined ? 1 : derived.width / path.width) +
      (point.localOffset?.x ?? 0),
    y:
      point.y * (path.height === undefined ? 1 : derived.height / path.height) +
      (point.localOffset?.y ?? 0),
  }
  const actual = worldPoint(document, 'connector', local)
  const expected = worldPoint(document, 'target', expectedSite)
  expect(actual.x).toBeCloseTo(expected.x, 8)
  expect(actual.y).toBeCloseTo(expected.y, 8)
  return derived
}
describe('semantic connector attachments', () => {
  it.each([
    [
      'multiple paths',
      (geometry) => {
        const extra = structuredClone(geometry.paths[0])
        extra.componentId = 'extraPath'
        for (const command of extra.commands)
          for (const point of command.points) point.componentId += '-extra'
        geometry.paths.push(extra)
      },
    ],
    [
      'multiple subpaths',
      (geometry) => {
        geometry.paths[0].commands.push({
          kind: 'moveTo',
          points: [{ componentId: 'subpathStart', x: 0, y: 0 }],
        })
      },
    ],
    [
      'arc',
      (geometry) => {
        geometry.paths[0].commands.push({
          kind: 'arcTo',
          wR: 10,
          hR: 5,
          stAng: 0,
          swAng: 5400000,
        })
      },
    ],
  ])('keeps %s routes unbound but rejects active attachments atomically', (_, mutate) => {
    const document = fixture()
    const geometry = document.definitions.connector.content.geometry
    mutate(geometry)
    const before = structuredClone(document)
    expect(core().connectorEndpointLocators(geometry)).toBeNull()
    expect(() => core().validateConnectorBindings(document)).toThrow(TypeError)
    expect(document).toEqual(before)
    document.instances.connector.connectorBindings.start = null
    expect(core().deriveConnectorGeometry(document, 'connector')).toEqual(geometry)
  })

  it.each([
    [0, 80],
    [100, 0],
    [0, 0],
  ])(
    'resolves both curve endpoints at collapsed extent %s by %s without moving controls',
    (width, height) => {
      const document = fixture()
      const geometry = document.definitions.connector.content.geometry
      geometry.width = width
      geometry.height = height
      geometry.paths[0].commands[1] = {
        kind: 'quadBezTo',
        points: [
          { componentId: 'control', x: 300, y: 20 },
          { componentId: 'tail', x: 1000, y: 800 },
        ],
      }
      document.instances.connector.connectorBindings.end = { targetInstanceId: 'target', index: 0 }
      const before = structuredClone(document)
      const derived = assertAttachment(document, { x: 25, y: 80 })
      const terminal = derived.paths[0].commands[1].points[1]
      const actual = worldPoint(document, 'connector', {
        x: (terminal.x * width) / 1000 + (terminal.localOffset?.x ?? 0),
        y: (terminal.y * height) / 800 + (terminal.localOffset?.y ?? 0),
      })
      const expected = worldPoint(document, 'target', { x: 25, y: 80 })
      expect(actual.x).toBeCloseTo(expected.x, 8)
      expect(actual.y).toBeCloseTo(expected.y, 8)
      expect(derived.paths[0].commands[1].points[0]).toEqual(
        before.definitions.connector.content.geometry.paths[0].commands[1].points[0]
      )
      expect(document).toEqual(before)
    }
  )

  it.each([
    [
      'bent',
      [
        { kind: 'lnTo', points: [{ componentId: 'bend', x: 400, y: 120 }] },
        { kind: 'lnTo', points: [{ componentId: 'tail', x: 1000, y: 800 }] },
      ],
    ],
    [
      'quadratic',
      [
        {
          kind: 'quadBezTo',
          points: [
            { componentId: 'control', x: 300, y: 20 },
            { componentId: 'tail', x: 1000, y: 800 },
          ],
        },
      ],
    ],
    [
      'cubic',
      [
        {
          kind: 'cubicBezTo',
          points: [
            { componentId: 'control1', x: 200, y: 20 },
            { componentId: 'control2', x: 400, y: 100 },
            { componentId: 'middle', x: 500, y: 300 },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            { componentId: 'control3', x: 600, y: 500 },
            { componentId: 'control4', x: 800, y: 700, localOffset: { x: 2, y: -3 } },
            { componentId: 'tail', x: 1000, y: 800 },
          ],
        },
      ],
    ],
  ])('resolves only the two %s endpoints across affine ancestry', (_, segments) => {
    const document = fixture()
    const geometry = document.definitions.connector.content.geometry
    geometry.paths[0].commands.splice(1, 1, ...segments)
    document.instances.connector.connectorBindings.end = { targetInstanceId: 'target', index: 0 }
    const before = structuredClone(document)
    const derived = assertAttachment(document, { x: 25, y: 80 })
    const path = derived.paths[0]
    const terminal = path.commands.at(-1).points.at(-1)
    const actual = worldPoint(document, 'connector', {
      x: (terminal.x * derived.width) / path.width + (terminal.localOffset?.x ?? 0),
      y: (terminal.y * derived.height) / path.height + (terminal.localOffset?.y ?? 0),
    })
    const expected = worldPoint(document, 'target', { x: 25, y: 80 })
    expect(actual.x).toBeCloseTo(expected.x, 8)
    expect(actual.y).toBeCloseTo(expected.y, 8)
    const preserved = structuredClone(path.commands)
    preserved[0].points[0] =
      before.definitions.connector.content.geometry.paths[0].commands[0].points[0]
    preserved.at(-1).points[preserved.at(-1).points.length - 1] = segments.at(-1).points.at(-1)
    expect(preserved).toEqual(before.definitions.connector.content.geometry.paths[0].commands)
    expect(core().connectorEndpointLocators(derived)).toEqual({
      start: { pathIndex: 0, commandIndex: 0, pointIndex: 0, componentId: 'connector-geometry-p0' },
      end: {
        pathIndex: 0,
        commandIndex: segments.length,
        pointIndex: segments.at(-1).points.length - 1,
        componentId: 'tail',
      },
    })
    expect(derived.connector).toEqual(before.definitions.connector.content.geometry.connector)
    expect(document).toEqual(before)
  })

  it('resolves complete reflected, skewed, nonuniform cross-group ancestry without mutation', () => {
    const document = fixture(),
      before = structuredClone(document)
    expect(core().validateConnectorBindings(document)).toBeUndefined()
    const derived = assertAttachment(document, { x: 25, y: 80 })
    expect(document).toEqual(before)
    expect(derived.connector).toEqual(before.definitions.connector.content.geometry.connector)
    expect(derived.paths[0].commands[1]).toEqual(
      before.definitions.connector.content.geometry.paths[0].commands[1]
    )
    derived.connector.start.shapeId = 'mutated'
    expect(document).toEqual(before)
  })
  it('re-evaluates target movement and occurrence-only geometry adjustment', () => {
    const document = fixture()
    document.instances.target.localTransform[4] += 17
    const override = structuredClone(document.definitions.target.content.geometry)
    override.adjustments[0].formula = 'val 65'
    document.instances.target.overrides.components = {
      'target-geometry': { geometryDocument: override },
    }
    assertAttachment(document, { x: 65, y: 80 })
    expect(document.definitions.target.content.geometry.adjustments[0].formula).toBe('val 25')
  })
  it.each([
    [0, 80],
    [100, 0],
    [0, 0],
  ])('represents zero extent (%s, %s) with finite local offsets', (width, height) => {
    const document = fixture(),
      geometry = document.definitions.connector.content.geometry
    geometry.width = width
    geometry.height = height
    const derived = assertAttachment(document, { x: 25, y: 80 })
    const point = derived.paths[0].commands[0].points[0]
    expect(Number.isFinite(point.localOffset.x)).toBe(true)
    expect(Number.isFinite(point.localOffset.y)).toBe(true)
  })
  it('uses native units when there is no explicit connector path grid', () => {
    const document = fixture(),
      path = document.definitions.connector.content.geometry.paths[0]
    delete path.width
    delete path.height
    assertAttachment(document, { x: 25, y: 80 })
  })
  it('keeps authored endpoint and geometry overrides when explicitly detached', () => {
    const document = fixture()
    document.instances.connector.connectorBindings.start = null
    const override = structuredClone(document.definitions.connector.content.geometry)
    override.paths[0].commands[0].points[0].x = 19
    document.instances.connector.overrides.components = {
      'connector-geometry': { geometryDocument: override },
    }
    expect(core().deriveConnectorGeometry(document, 'connector')).toEqual(override)
  })
  it('resolves both ends and allows binding an originally free endpoint', () => {
    const document = fixture()
    document.instances.connector.connectorBindings.end = { targetInstanceId: 'target', index: 0 }
    const derived = assertAttachment(document, { x: 25, y: 80 })
    expect(derived.paths[0].commands[1].points[0].x).toBe(derived.paths[0].commands[0].points[0].x)
  })
  it.each([
    [
      'missing target',
      (d) => {
        d.instances.connector.connectorBindings.start.targetInstanceId = 'missing'
      },
    ],
    [
      'inactive target',
      (d) => {
        d.instances.target.lineage = { tombstone: true }
      },
    ],
    [
      'inactive ancestor',
      (d) => {
        d.instances.right.lineage = { tombstone: true }
      },
    ],
    [
      'paint-only target',
      (d) => {
        d.instances.target.lineage = { paintOnly: true }
      },
    ],
    [
      'different slide',
      (d) => {
        d.instances.target.slideId = 'other'
      },
    ],
    [
      'different placement',
      (d) => {
        d.instances.target.relationshipChain.push('layout')
      },
    ],
    [
      'different part',
      (d) => {
        d.definitions.target.source.partUri = 'ppt/slides/slide2.xml'
      },
    ],
    [
      'invalid site',
      (d) => {
        d.instances.connector.connectorBindings.start.index = 2
      },
    ],
    [
      'negative site',
      (d) => {
        d.instances.connector.connectorBindings.start.index = -1
      },
    ],
    [
      'fractional site',
      (d) => {
        d.instances.connector.connectorBindings.start.index = 0.5
      },
    ],
    [
      'connector target',
      (d) => {
        d.instances.connector.connectorBindings.start.targetInstanceId = 'connector'
      },
    ],
    [
      'incomplete binding',
      (d) => {
        delete d.instances.connector.connectorBindings.start
      },
    ],
    [
      'missing binding record',
      (d) => {
        delete d.instances.connector.connectorBindings
      },
    ],
    [
      'extra binding field',
      (d) => {
        d.instances.connector.connectorBindings.start.extra = true
      },
    ],
    [
      'invalid source target',
      (d) => {
        d.definitions.connector.content.geometry.connector.start.targetDefinitionId = 'missing'
      },
    ],
    [
      'wrong native identity',
      (d) => {
        d.definitions.connector.content.geometry.connector.start.shapeId = '99'
      },
    ],
    [
      'source site missing',
      (d) => {
        d.definitions.connector.content.geometry.connector.start.index = 3
      },
    ],
    [
      'source component missing',
      (d) => {
        d.definitions.connector.content.geometry.connector.start.componentId = 'missing'
      },
    ],
    [
      'source component wrong kind',
      (d) => {
        d.definitions.connector.components[1].kind = 'path'
      },
    ],
    [
      'source identity override',
      (d) => {
        const override = structuredClone(d.definitions.connector.content.geometry)
        override.connector.start.shapeId = '99'
        d.instances.connector.overrides.components = {
          'connector-geometry': { geometryDocument: override },
        }
      },
    ],
    [
      'binding on nonconnector',
      (d) => {
        d.instances.target.connectorBindings = { start: null }
      },
    ],
    [
      'unsupported route',
      (d) => {
        d.definitions.connector.content.geometry.paths[0].commands.push({ kind: 'close' })
      },
    ],
    [
      'schemaVersion 3 with invalid source endpoint target',
      (d) => {
        d.schemaVersion = 3
        d.definitions.connector.content.geometry.connector.start.targetDefinitionId = 'missing'
      },
    ],
    [
      'schemaVersion 3 with binding on nonconnector',
      (d) => {
        d.schemaVersion = 3
        d.instances.target.connectorBindings = { start: null }
      },
    ],
  ])('rejects %s without mutation', (_, mutate) => {
    const { validateConnectorBindings } = core()
    const document = fixture()
    mutate(document)
    const before = structuredClone(document)
    expect(() => validateConnectorBindings(document)).toThrow()
    expect(document).toEqual(before)
  })

  it('validates and derives connector geometry on schemaVersion 3 documents', () => {
    const document = fixture()
    document.schemaVersion = 3
    const before = structuredClone(document)
    expect(core().validateConnectorBindings(document)).toBeUndefined()
    const derived = assertAttachment(document, { x: 25, y: 80 })
    expect(document).toEqual(before)
    expect(derived.connector).toEqual(before.definitions.connector.content.geometry.connector)
  })

  it('detaches connector bindings on schemaVersion 3 using persistent copy-on-write', () => {
    const document = fixture()
    document.schemaVersion = 3
    const before = structuredClone(document)
    const detached = core().detachConnectorBindingsFromTargets(document, ['target'])
    expect(document).toEqual(before)
    expect(detached.instances.connector.connectorBindings.start).toBeNull()
    expect(
      detached.instances.connector.overrides.components['connector-geometry'].geometryDocument
    ).toBeDefined()
  })
})
