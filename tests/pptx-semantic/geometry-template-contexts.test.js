import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-document.js'
import core from '../../shared/src/pptx-geometry-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import operations from '../../shared/src/pptx-projection-operation.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

function fixture() {
  const document = inheritedGeometryStyleFixture()
  const geometry = document.definitions.definition.content.geometry
  geometry.schemaVersion = 2
  delete geometry.width
  delete geometry.height
  delete document.definitions.definition.content.extent
  delete document.styles.provider.payload.transform.value.ext
  geometry.connections = [{ componentId: 'site', angle: 0, position: { x: 'tip', y: 'h' } }]
  for (const [index, width] of [100, 200].entries()) {
    const local = document.styles[`local${index + 1}`]
    local.payload.transform = authored(
      {
        ext: authored(
          { cx: authored(width, local.source.partUri), cy: authored(80, local.source.partUri) },
          local.source.partUri
        ),
      },
      local.source.partUri
    )
    document.styles[`context${index + 1}`].payload.transformDeclarationIds = [
      `local${index + 1}`,
      'provider',
    ]
  }
  return document
}
const normalize = semantic.normalizePptxSemanticDocument

describe('checked source-template occurrence contexts', () => {
  it('compiles distinct numeric guides/sites from one unchanged template and preserves source after reload', () => {
    const document = normalize(fixture()),
      before = JSON.stringify(document)
    for (const [id, contextId, width, tip] of [
      ['i1', 'context1', 100, 25],
      ['i2', 'context2', 200, 50],
    ]) {
      const source = resolution.sourceGeometryForContext(document, contextId)
      expect(source).toMatchObject({ schemaVersion: 1, width, height: 80 })
      expect(source).not.toHaveProperty('style')
      expect(core.evaluateGeometryGuides(source).tip).toBe(tip)
      expect(core.deriveGeometryPaths(source).connections[0].position).toEqual({ x: tip, y: 80 })
      expect(resolution.materializeGeometry(document, id).width).toBe(width)
    }
    expect(JSON.stringify(document)).toBe(before)
    expect(normalize(JSON.parse(before))).toEqual(document)
    expect(document.definitions.definition.content.geometry).not.toHaveProperty('width')
    expect(document.definitions.definition.content.geometry).not.toHaveProperty('height')
    expect(document.definitions.definition.content.geometry).not.toHaveProperty('style')
  })
  it('admits actual zero extents without converting them to a nonzero stand-in', () => {
    const input = fixture()
    input.styles.local1.payload.transform.value.ext.value.cx.value = 0
    const document = normalize(input),
      source = resolution.materializeGeometry(document, 'i1')
    expect(source.width).toBe(0)
    expect(core.evaluateGeometryGuides(source).tip).toBe(0)
    expect(core.deriveGeometryPaths(source).connections[0].position.x).toBe(0)
  })
  it.each(['plain', 'hidden', 'tombstone', 'suppressed', 'masked', 'reversed'])(
    'compiles every protected higher-order template context rather than caching another success (%s)',
    (state) => {
      const input = fixture()
      const geometry = input.definitions.definition.content.geometry
      geometry.guides = [
        { name: 'square', formula: '*/ w w 1' },
        { name: 'fourth', formula: '*/ square square 1' },
        { name: 'third', formula: '*/ fourth 1 w' },
        { name: 'denominator', formula: '+- w 0 h' },
        { name: 'ratio', formula: '*/ fourth 1 denominator' },
        { name: 'tip', formula: '*/ ratio denominator third' },
      ]
      for (const index of [1, 2])
        input.styles[`local${index}`].payload.transform.value.ext.value.cx.value = index * 1000000
      expect(() => normalize(input)).not.toThrow()
      const validOverride = resolution.materializeGeometry(input, 'i1')
      input.styles.local2.payload.transform.value.ext.value.cx.value = 80
      if (state === 'hidden') input.instances.i2.overrides.hidden = true
      if (state === 'tombstone') input.instances.i2.lineage = { tombstone: true }
      if (state === 'suppressed') delete input.instances.i2
      if (state === 'masked') {
        delete validOverride.style
        input.instances.i2.overrides.components = {
          geometry: { geometryDocument: validOverride },
        }
      }
      if (state === 'reversed')
        input.styles = Object.fromEntries(Object.entries(input.styles).reverse())
      const before = structuredClone(input)
      expect(() => normalize(input)).toThrow(/division by zero/)
      expect(() => normalize(JSON.parse(JSON.stringify(input)))).toThrow(/division by zero/)
      expect(input).toEqual(before)
    }
  )
  it.each(['plain', 'hidden', 'tombstone', 'suppressed', 'masked', 'reversed'])(
    'rejects an invalid real source context independently of occurrence state (%s)',
    (state) => {
      const input = fixture()
      // A previously numeric schema1 source can also become invalid at a host extent.
      // Its valid source/override extent must not conceal the other checked context.
      const geometry = input.definitions.definition.content.geometry
      Object.assign(geometry, { schemaVersion: 1, width: 100, height: 80 })
      geometry.guides = [
        { name: 'denominator', formula: '+- w 0 h' },
        { name: 'tip', formula: '*/ w 1 denominator' },
      ]
      const validOverride = core.normalizeGeometryDocument(geometry)
      expect(() => normalize(input)).not.toThrow()
      input.styles.local2.payload.transform.value.ext.value.cx.value = 80
      if (state === 'hidden') input.instances.i2.overrides.hidden = true
      if (state === 'tombstone') input.instances.i2.lineage = { tombstone: true }
      if (state === 'suppressed') delete input.instances.i2
      if (state === 'masked')
        input.instances.i2.overrides.components = {
          geometry: { geometryDocument: validOverride },
        }
      if (state === 'reversed')
        input.styles = Object.fromEntries(Object.entries(input.styles).reverse())
      const before = structuredClone(input)
      expect(() => normalize(input)).toThrow()
      expect(input).toEqual(before)
    }
  )
  it('permits real template-backed geometry operations while retaining source, sibling and sparse style', () => {
    const document = normalize(fixture()),
      source = JSON.stringify(document.definitions)
    const presentation = { ...geometryProjectionFixture(), pptxSemantic: document }
    expect(capabilities.getProjectionCapabilities(document, 'i1').operations).toContain(
      capabilities.GEOMETRY_EDIT
    )
    const operation = (command) => ({
      type: capabilities.GEOMETRY_EDIT,
      instanceId: 'i1',
      componentId: 'geometry',
      command,
    })
    const painted = operations.applyPresentationProjectionOperation(
      presentation,
      operation({ type: 'stroke-cap', cap: 'flat' })
    )
    const edited = operations.applyPresentationProjectionOperation(
      painted,
      operation({
        type: 'control-point',
        componentId: 'control',
        x: 33,
      })
    )
    const override = edited.pptxSemantic.instances.i1.overrides.components.geometry
    expect(override.geometryDocument).toMatchObject({ schemaVersion: 1, width: 100, height: 80 })
    expect(override.geometryDocument).not.toHaveProperty('style')
    expect(override.geometryStyle).toEqual({ stroke: { cap: 'flat' } })
    expect(JSON.stringify(edited.pptxSemantic.definitions)).toBe(source)
    expect(edited.pptxSemantic.styles).toEqual(document.styles)
    expect(edited.pptxSemantic.instances.i2).toEqual(document.instances.i2)
    const reloaded = normalize(JSON.parse(JSON.stringify(edited.pptxSemantic)))
    expect(resolution.materializeGeometry(reloaded, 'i1').style.stroke.cap).toBe('flat')
    expect(resolution.materializeGeometry(reloaded, 'i2').width).toBe(200)
    expect(resolution.materializeGeometry(reloaded, 'i2').paths).toEqual(
      resolution.materializeGeometry(document, 'i2').paths
    )
    const locked = JSON.parse(JSON.stringify(edited.pptxSemantic))
    locked.instances.i1.overrides.locked = true
    expect(capabilities.getProjectionCapabilities(locked, 'i1').operations).toEqual([])
  })
  it('allows templates only in linked source definitions, never in replacements or schema1', () => {
    const document = normalize(fixture())
    const replaced = JSON.parse(JSON.stringify(document))
    replaced.instances.i1.overrides.components = {
      geometry: { geometryDocument: replaced.definitions.definition.content.geometry },
    }
    expect(() => normalize(replaced)).toThrow()
    const schema1 = geometryProjectionFixture().pptxSemantic
    schema1.definitions.definition.content.geometry =
      document.definitions.definition.content.geometry
    expect(() => normalize(schema1)).toThrow()
    const project = JSON.parse(JSON.stringify(document))
    project.definitions.definition.origin = 'project'
    expect(() => normalize(project)).toThrow()
  })
  it.each([1, 2])(
    'rejects templates in otherwise valid project groups under semantic schema %s',
    (schemaVersion) => {
      const input = schemaVersion === 1 ? geometryProjectionFixture().pptxSemantic : fixture()
      input.definitions.group = {
        id: 'group',
        kind: 'group',
        origin: 'project',
        source: null,
        components: [],
        content: {},
      }
      expect(() => normalize(input)).not.toThrow()
      input.definitions.group.content.geometry = structuredClone(
        fixture().definitions.definition.content.geometry
      )
      const before = structuredClone(input)
      expect(() => normalize(input)).toThrow(/templates require linked source definitions/i)
      expect(() => normalize(JSON.parse(JSON.stringify(input)))).toThrow(
        /templates require linked source definitions/i
      )
      expect(input).toEqual(before)
    }
  )
})
