import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-document.js'
import records from '../../shared/src/pptx-geometry-style-records.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import JSZip from 'jszip'
import inventoryModule from '../../server/services/pptx-import/semantic-inventory.js'
import sourceModule from '../../server/services/pptx-import/ooxml-geometry-style-source.js'

const hash = 'a'.repeat(64)
const location = (partUri, path = [0, 0]) => ({
  partUri,
  preconditionHash: hash,
  componentLocator: { path, preconditionHash: hash },
})
function fixture() {
  const document = geometryProjectionFixture().pptxSemantic
  document.schemaVersion = 2
  const definition = document.definitions.definition
  definition.source.partUri = 'ppt/slideLayouts/slideLayout1.xml'
  definition.source.componentLocator = location(definition.source.partUri).componentLocator
  const slide = structuredClone(definition)
  slide.id = 'slide'
  slide.source = { ...location('ppt/slides/slide1.xml'), nativeId: '3' }
  slide.components = []
  slide.content = {}
  document.definitions.slide = slide
  const wrap = (value, part = definition.source.partUri, path = [0, 0, 0]) => ({
    source: location(part, path),
    value,
  })
  const record = (kind, part, payload) => ({
    kind,
    origin: 'source',
    source: location(part),
    payload,
  })
  definition.content.geometrySource = { styleId: 'provider' }
  slide.content.geometrySource = { styleId: 'local' }
  document.styles.provider = record('geometry-declarations', definition.source.partUri, {
    definitionId: 'definition',
    properties: {},
    styleRefs: {},
    placeholder: wrap({ idx: '0', type: 'body' }),
    geometry: { definitionId: 'definition', componentId: 'geometry' },
    transform: wrap({
      off: wrap({ x: wrap(0), y: wrap(0) }),
      ext: wrap({ cx: wrap(100), cy: wrap(80) }),
    }),
  })
  document.styles.local = record('geometry-declarations', slide.source.partUri, {
    definitionId: 'slide',
    properties: {},
    styleRefs: {},
    placeholder: wrap({ idx: '0', type: 'body' }, slide.source.partUri),
  })
  document.styles.theme = record('theme', 'ppt/theme/theme1.xml', {
    colors: { accent1: wrap({ kind: 'srgb', value: '123456' }, 'ppt/theme/theme1.xml') },
    fillStyles: [wrap({ kind: 'unsupported', reason: 'unrepresented' }, 'ppt/theme/theme1.xml')],
    backgroundFillStyles: [],
    lineStyles: [],
    effectStyles: [],
  })
  const edges = [
    ['ppt/slides/slide1.xml', definition.source.partUri, 'rLayout', 'slideLayout'],
    [definition.source.partUri, 'ppt/slideMasters/slideMaster1.xml', 'rMaster', 'slideMaster'],
    ['ppt/slideMasters/slideMaster1.xml', 'ppt/theme/theme1.xml', 'rTheme', 'theme'],
  ].map(([fromPartUri, toPartUri, relationshipId, suffix]) => ({
    fromPartUri,
    toPartUri,
    relationshipId,
    type: `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${suffix}`,
    source: location(fromPartUri.replace(/([^/]+)$/, '_rels/$1.rels')),
  }))
  document.styles.context = record('geometry-context', slide.source.partUri, {
    definitionId: 'slide',
    hostSlidePartUri: slide.source.partUri,
    relationshipChain: [slide.source.partUri],
    edges,
    declarationIds: ['local', 'provider'],
    geometry: { definitionId: 'definition', componentId: 'geometry' },
    transformDeclarationIds: ['provider'],
    themeId: 'theme',
    colorMapIds: [],
    matrixBindings: {},
  })
  for (const instance of Object.values(document.instances)) {
    instance.definitionId = 'slide'
    instance.sourceBinding = { contextId: 'context' }
    instance.relationshipChain = [slide.source.partUri]
  }
  return document
}
const normalize = (document) => semantic.normalizePptxSemanticDocument(document)
const override = (document, value) => {
  document.instances.i1.overrides.components = { geometry: value }
}
describe('linked geometry schema and sparse intent', () => {
  it('accepts the exact source-module wrappers and context with real ZIP hashes and locators', async () => {
    const zip = new JSZip()
    const p = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    const a = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    zip.file(
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>'
    )
    zip.file(
      'ppt/presentation.xml',
      `<p:presentation xmlns:p="${p}" xmlns:r="${r}"><p:sldIdLst><p:sldId id="256" r:id="slide"/></p:sldIdLst></p:presentation>`
    )
    zip.file(
      'ppt/_rels/presentation.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="slide" Type="${r}/slide" Target="slides/one.xml"/></Relationships>`
    )
    zip.file(
      'ppt/slides/one.xml',
      `<p:sld xmlns:p="${p}" xmlns:a="${a}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Source"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm flipH="false" rot="0"><a:off x="0" y="0"/><a:ext cx="100" cy="80"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="123456"><a:alpha val="0"/></a:srgbClr></a:solidFill><a:ln w="0"><a:noFill/><a:round/></a:ln><a:effectLst/></p:spPr></p:sp></p:spTree></p:cSld></p:sld>`
    )
    const inventory = await inventoryModule.buildSemanticInventory(zip)
    const built = await sourceModule.buildGeometryStyleSources(zip, inventory)
    const sourceDefinition = inventory.definitions.find((d) => d.kind === 'shape')
    const component = inventory.definitions.find(
      (d) => d.parentDefinitionId === sourceDefinition.id && d.kind === 'preset-geometry'
    )
    const geometry =
      geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
    geometry.componentId = component.id
    const sourceOccurrence = inventory.occurrences.find(
      (o) => o.definitionId === sourceDefinition.id
    )
    const document = {
      schemaVersion: 2,
      styles: built.styles,
      fonts: {},
      definitions: {
        [sourceDefinition.id]: {
          id: sourceDefinition.id,
          kind: 'shape',
          source: {
            partUri: sourceDefinition.partUri,
            preconditionHash: sourceDefinition.preconditionHash,
            nativeId: sourceDefinition.nativeId,
          },
          components: [
            { id: component.id, kind: 'property', locator: component.componentLocators[0] },
          ],
          content: { geometry, geometrySource: built.definitionBindings[sourceDefinition.id] },
        },
      },
      instances: {
        [sourceOccurrence.id]: {
          id: sourceOccurrence.id,
          slideId: 's',
          definitionId: sourceDefinition.id,
          parentInstanceId: null,
          localTransform: [1, 0, 0, 1, 0, 0],
          paintIndex: 0,
          overrides: {},
          relationshipChain: sourceOccurrence.relationshipChain,
          sourceBinding: built.occurrenceBindings[sourceOccurrence.id],
        },
      },
    }
    const normalized = normalize(document)
    expect(normalized.styles).toEqual(built.styles)
    expect(
      records.geometryProvider(normalized, normalized.instances[sourceOccurrence.id]).geometry
        .componentId
    ).toBe(component.id)
  })
  it('retains schema one full styled replacements unchanged', () => {
    const document = geometryProjectionFixture().pptxSemantic
    const geometry = structuredClone(document.definitions.definition.content.geometry)
    geometry.style = { fill: { color: { kind: 'srgb', value: '123456' } } }
    override(document, { geometryDocument: geometry })
    expect(normalize(document).instances.i1.overrides.components.geometry.geometryDocument).toEqual(
      geometry
    )
    expect(records.geometryProvider(document, document.instances.i1).geometry).toBe(
      document.definitions.definition.content.geometry
    )
  })
  it('uses the exact protected inherited provider without fabricating local geometry', () => {
    const document = normalize(fixture())
    const provider = records.geometryProvider(document, document.instances.i1)
    expect(provider.definition).toBe(document.definitions.definition)
    expect(provider.geometry).toBe(document.definitions.definition.content.geometry)
    expect(document.definitions.slide.content.geometry).toBeUndefined()
    expect(Object.isFrozen(document.styles.provider.payload)).toBe(true)
    expect(document.styles.theme.payload.fillStyles[0].value.kind).toBe('unsupported')
  })
  it('accepts sparse intent, explicit no fill, empty effects and native-default nulls', () => {
    const document = fixture()
    override(document, {
      geometryStyle: {
        fill: { color: { kind: 'none' } },
        effects: { kind: 'list', effects: [] },
        stroke: { width: 0, cap: null, join: null, headEnd: null, tailEnd: null },
      },
    })
    expect(normalize(document).instances.i1.overrides).toEqual(document.instances.i1.overrides)
  })
  it('accepts intentional visible-equal RGB and a style-free structural edit together', () => {
    const document = fixture()
    const geometryDocument = structuredClone(document.definitions.definition.content.geometry)
    geometryDocument.paths[0].commands[0].points[0].x = 4
    override(document, {
      geometryDocument,
      geometryStyle: { fill: { color: { kind: 'srgb', value: '123456' } } },
    })
    expect(normalize(document).instances.i1.overrides).toEqual(document.instances.i1.overrides)
  })
  it.each([
    (d) => {
      d.schemaVersion = 3
    },
    (d) => {
      delete d.styles.provider
    },
    (d) => {
      d.definitions.slide.content.geometrySource.styleId = 'theme'
    },
    (d) => {
      d.styles.local.payload.definitionId = 'definition'
    },
    (d) => {
      d.styles.local.source.preconditionHash = 'b'.repeat(64)
    },
    (d) => {
      d.styles.local.source.componentLocator.path = []
    },
    (d) => {
      d.styles.provider.payload.transform.value.ext.value.cx.value = '100'
    },
    (d) => {
      d.styles.provider.payload.transform.value.ext.value.cx.source.partUri =
        'ppt/slides/slide1.xml'
    },
    (d) => {
      d.styles.theme.payload.colors.accent1.value.value = 'zzzzzz'
    },
    (d) => {
      d.styles.theme.payload.colors.accent1.value.kind = 'invented'
    },
    (d) => {
      d.styles.context.payload.geometry.componentId = 'control'
    },
    (d) => {
      d.styles.context.payload.geometry.definitionId = 'slide'
    },
    (d) => {
      d.styles.context.payload.declarationIds = ['provider', 'local']
    },
    (d) => {
      d.styles.context.payload.declarationIds = ['local', 'context']
    },
    (d) => {
      d.styles.context.payload.edges[0].source.partUri = 'ppt/slides/slide1.xml'
    },
    (d) => {
      d.styles.context.payload.edges[0].toPartUri = 'ppt/slides/slide1.xml'
    },
    (d) => {
      d.styles.context.payload.relationshipChain.push('invented')
    },
    (d) => {
      d.instances.i1.relationshipChain = ['ppt/slides/slide2.xml']
    },
    (d) => {
      d.instances.i1.sourceBinding.contextId = 'provider'
    },
    (d) => {
      d.instances.i1.sourceBinding.extra = true
    },
    (d) => {
      delete d.instances.i1.sourceBinding
    },
    (d) => {
      d.styles.context.payload.transformDeclarationIds = ['local']
    },
    (d) => {
      d.styles.theme.extra = true
    },
    (d) => {
      d.styles.theme.origin = 'project'
    },
  ])('rejects malformed source graph case %#', (change) => {
    const document = fixture()
    change(document)
    expect(() => normalize(document)).toThrow()
  })
  it.each([
    { stroke: { width: null } },
    { stroke: { color: null } },
    { fill: null },
    { effects: null },
    { stroke: { dash: null } },
    { stroke: { unknown: 1 } },
    { unknown: true },
    { fill: { kind: 'scheme', value: 'accent1' } },
    { stroke: { width: -1 } },
    { stroke: { cap: 'unknown' } },
    { stroke: { join: { kind: 'round', limit: 3 } } },
    { stroke: { headEnd: { type: 'unknown' } } },
    { effects: [] },
  ])('rejects unsupported sparse style %#', (geometryStyle) => {
    const document = fixture()
    override(document, { geometryStyle })
    expect(() => normalize(document)).toThrow()
  })
  it('rejects style in structural replacements and cross-provider overrides', () => {
    const document = fixture()
    const geometryDocument = structuredClone(document.definitions.definition.content.geometry)
    geometryDocument.style = { fill: { color: { kind: 'none' } } }
    override(document, { geometryDocument })
    expect(() => normalize(document)).toThrow()
    document.instances.i1.overrides.components = { control: { geometryStyle: {} } }
    expect(() => normalize(document)).toThrow()
  })
  it.each([null, { unknown: true }, { text: 'untyped' }])(
    'rejects untyped provider overrides %#',
    (value) => {
      const document = fixture()
      override(document, value)
      expect(() => normalize(document)).toThrow()
    }
  )
  it('rejects a selected unsupported matrix entry without promoting an unused entry', () => {
    const document = fixture()
    document.styles.local.payload.styleRefs.fillRef = {
      source: location('ppt/slides/slide1.xml', [0, 0, 1]),
      value: {
        index: 1,
        color: {
          source: location('ppt/slides/slide1.xml', [0, 0, 1, 0]),
          value: { kind: 'srgb', value: '123456' },
        },
      },
    }
    document.styles.context.payload.matrixBindings.fillRef = {
      declarationId: 'local',
      index: 1,
      themeId: 'theme',
      list: 'fillStyles',
      entryIndex: 0,
      source: document.styles.theme.payload.fillStyles[0].source,
    }
    expect(() => normalize(document)).toThrow()
  })
  it('accepts only sparse colors theme edits with one override per source theme', () => {
    const document = fixture()
    document.styles.edit = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent1: { kind: 'srgb', value: '654321' } } },
    }
    expect(normalize(document).styles.edit).toEqual(document.styles.edit)
    document.styles.edit.values.fillStyles = []
    expect(() => normalize(document)).toThrow()
    delete document.styles.edit.values.fillStyles
    document.styles.edit2 = structuredClone(document.styles.edit)
    expect(() => normalize(document)).toThrow()
    delete document.styles.edit2
    document.styles.edit.baseStyleId = 'edit'
    expect(() => normalize(document)).toThrow()
  })
  it('checks authored nested colors, lines, transforms and shadow locations without resolving them', () => {
    const document = fixture()
    const wrap = (value) => ({ source: location('ppt/slides/slide1.xml', [0, 0, 0]), value })
    const color = wrap({
      kind: 'scheme',
      value: 'accent1',
      transforms: [wrap({ kind: 'alpha', value: 0 })],
    })
    document.styles.local.payload.properties = {
      fill: wrap({ color }),
      stroke: wrap({
        color,
        width: wrap(0),
        cap: wrap('rnd'),
        dash: wrap({ kind: 'custom', stops: [wrap({ dash: wrap(0), space: wrap(2) })] }),
        join: wrap({ kind: 'miter', limit: wrap(0) }),
        headEnd: wrap({ type: wrap('arrow'), w: wrap('sm'), len: wrap('lg') }),
      }),
      effects: wrap({
        kind: 'list',
        effects: [wrap({ kind: 'outerShdw', color, dist: wrap(0), rotWithShape: wrap(false) })],
      }),
    }
    expect(normalize(document).styles.local.payload.properties).toEqual(
      document.styles.local.payload.properties
    )
    document.styles.local.payload.properties.stroke.value.dash.value.stops[0].value.dash.value = -1
    expect(() => normalize(document)).toThrow()
  })
  it.each([0, 1000, 1001])('preserves checked matrix sentinel or entry binding %s', (index) => {
    const document = fixture()
    const wrap = (value) => ({ source: location('ppt/slides/slide1.xml', [0, 0, 0]), value })
    document.styles.local.payload.styleRefs.fillRef = wrap({
      index,
      color: wrap({ kind: 'srgb', value: '123456' }),
    })
    const entry = {
      source: location('ppt/theme/theme1.xml', [0, 0, 0]),
      value: {
        color: {
          source: location('ppt/theme/theme1.xml', [0, 0, 0]),
          value: { kind: 'none' },
        },
      },
    }
    document.styles.theme.payload.backgroundFillStyles = [entry]
    document.styles.context.payload.matrixBindings.fillRef = {
      declarationId: 'local',
      index,
      themeId: 'theme',
      list: index === 1001 ? 'backgroundFillStyles' : 'fillStyles',
      entryIndex: index === 1001 ? 0 : null,
      ...(index === 1001 ? { source: entry.source } : {}),
    }
    expect(normalize(document).styles.context.payload.matrixBindings.fillRef.index).toBe(index)
    document.styles.context.payload.matrixBindings.fillRef.index += 1
    expect(() => normalize(document)).toThrow()
  })
  it('rejects missing eligible candidates rather than changing inheritance priority', () => {
    const document = fixture()
    document.styles.context.payload.declarationIds = ['local']
    expect(() => normalize(document)).toThrow()
    delete document.definitions.definition.content.geometrySource
    expect(() => normalize(document)).toThrow()
  })
  it('validates gradients against real provider path modifiers and preserves structural identities', () => {
    const document = fixture()
    const gradient = {
      kind: 'linear',
      angle: 0,
      scaled: false,
      rotWithShape: true,
      stops: [
        { pos: 0, color: { kind: 'srgb', value: '123456' } },
        { pos: 100000, color: { kind: 'srgb', value: '654321' } },
      ],
    }
    override(document, { geometryStyle: { fill: { gradient }, stroke: { cap: 'rnd' } } })
    expect(
      normalize(document).instances.i1.overrides.components.geometry.geometryStyle.fill.gradient
    ).toEqual(gradient)
    document.definitions.definition.content.geometry.paths[0].fill = 'darken'
    const before = structuredClone(document)
    const shaded = normalize(document)
    expect(shaded.instances.i1.overrides.components.geometry.geometryStyle.fill.gradient).toEqual(
      gradient
    )
    expect(shaded.definitions.definition.content.geometry.paths[0].fill).toBe('darken')
    expect(shaded.definitions).toEqual(before.definitions)
    expect(shaded.instances.i2).toEqual(before.instances.i2)
    expect(document).toEqual(before)
    delete document.definitions.definition.content.geometry.paths[0].fill
    const geometryDocument = structuredClone(document.definitions.definition.content.geometry)
    geometryDocument.paths[0].commands[0].points[0].componentId = 'invented'
    override(document, { geometryDocument })
    expect(() => normalize(document)).toThrow()
  })
  it('accepts sparse scheme intent and token paint without materializing source declarations', () => {
    const document = fixture()
    override(document, {
      geometryStyle: {
        fill: { color: { kind: 'token', value: 'var(--ns-accent)' } },
        stroke: { color: { kind: 'scheme', value: 'accent1' } },
      },
    })
    expect(normalize(document).instances.i1.overrides).toEqual(document.instances.i1.overrides)
  })
  it('keeps descriptor rejection and explicit semantic budgets', () => {
    const document = fixture()
    let invoked = false
    Object.defineProperty(document.styles.theme.payload.colors, 'unsafe', {
      enumerable: true,
      get() {
        invoked = true
        return {}
      },
    })
    expect(() => normalize(document)).toThrow()
    expect(invoked).toBe(false)
    expect(() => semantic.normalizePptxSemanticDocument(fixture(), { maxComponents: 1 })).toThrow()
  })
})
