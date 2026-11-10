// Synthetic validated source graph, not native or dashboard qualification.
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

const hash = 'a'.repeat(64)
const layout = 'ppt/slideLayouts/slideLayout1.xml'
export const styleLocation = (partUri, path = [0, 0]) => ({
  partUri,
  preconditionHash: hash,
  componentLocator: { path, preconditionHash: hash },
})
export const authored = (value, partUri = layout) => ({
  source: styleLocation(partUri, [0, 0, 0]),
  value,
})
const record = (kind, partUri, payload) => ({
  kind,
  origin: 'source',
  source: styleLocation(partUri),
  payload,
})
export function geometryStyleFixture() {
  const document = geometryProjectionFixture().pptxSemantic
  document.schemaVersion = 2
  const definition = document.definitions.definition
  definition.source.partUri = layout
  definition.source.componentLocator = styleLocation(layout).componentLocator
  definition.content.geometrySource = { styleId: 'provider' }
  document.styles.provider = record('geometry-declarations', layout, {
    definitionId: definition.id,
    geometry: { definitionId: definition.id, componentId: 'geometry' },
    properties: {
      fill: authored({ color: authored({ kind: 'scheme', value: 'accent1' }) }),
      stroke: authored({
        color: authored({ kind: 'scheme', value: 'accent1' }),
        width: authored(38100),
        dash: authored({ kind: 'preset', value: 'dash' }),
        cap: authored('rnd'),
      }),
      effects: authored({
        kind: 'list',
        effects: [
          authored({
            kind: 'outerShdw',
            color: authored({ kind: 'scheme', value: 'accent1' }),
            dist: authored(0),
            rotWithShape: authored(false),
          }),
        ],
      }),
    },
    styleRefs: {},
    transform: authored({
      off: authored({ x: authored(0), y: authored(-9525) }),
      ext: authored({ cx: authored(100), cy: authored(80) }),
      rot: authored(0),
      flipH: authored(false),
    }),
  })
  const theme = 'ppt/theme/theme1.xml'
  document.styles.theme = record('theme', theme, {
    colors: Object.fromEntries(
      [
        ['accent1', '123456'],
        ['accent2', 'FF0000'],
        ['accent3', '00FF00'],
      ].map(([slot, value]) => [slot, authored({ kind: 'srgb', value }, theme)])
    ),
    fillStyles: [],
    backgroundFillStyles: [],
    lineStyles: [],
    effectStyles: [],
  })
  for (const [index, instance] of Object.values(document.instances).entries()) {
    const slide = `ppt/slides/slide${index + 1}.xml`
    const edges = [
      [slide, layout, 'rLayout', 'slideLayout'],
      [layout, 'ppt/slideMasters/slideMaster1.xml', 'rMaster', 'slideMaster'],
      ['ppt/slideMasters/slideMaster1.xml', theme, 'rTheme', 'theme'],
    ].map(([fromPartUri, toPartUri, relationshipId, suffix]) => ({
      fromPartUri,
      toPartUri,
      relationshipId,
      type: `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${suffix}`,
      source: styleLocation(fromPartUri.replace(/([^/]+)$/, '_rels/$1.rels')),
    }))
    const contextId = `context${index + 1}`,
      mapId = `map${index + 1}`
    document.styles[mapId] = record('color-map', slide, {
      kind: 'mapping',
      values: { accent1: authored(`accent${index + 2}`, slide) },
    })
    document.styles[contextId] = record('geometry-context', layout, {
      definitionId: definition.id,
      hostSlidePartUri: slide,
      relationshipChain: [slide, 'rLayout'],
      edges,
      declarationIds: ['provider'],
      geometry: { definitionId: definition.id, componentId: 'geometry' },
      transformDeclarationIds: ['provider'],
      themeId: 'theme',
      colorMapIds: [mapId],
      matrixBindings: {},
    })
    instance.sourceBinding = { contextId }
    instance.relationshipChain = [slide, 'rLayout']
  }
  return document
}

export function inheritedGeometryStyleFixture() {
  const document = geometryStyleFixture()
  document.styles.provider.payload.placeholder = authored({ idx: '0', type: 'body' })
  for (const [index, instance] of Object.values(document.instances).entries()) {
    const partUri = `ppt/slides/slide${index + 1}.xml`
    const definitionId = `local${index + 1}`
    document.definitions[definitionId] = {
      id: definitionId,
      kind: 'shape',
      source: { ...styleLocation(partUri), nativeId: '3' },
      components: [],
      content: { geometrySource: { styleId: definitionId } },
    }
    document.styles[definitionId] = record('geometry-declarations', partUri, {
      definitionId,
      properties: {},
      styleRefs: {},
      placeholder: authored({ idx: '0', type: 'body' }, partUri),
    })
    const context = document.styles[`context${index + 1}`]
    context.source = styleLocation(partUri)
    context.payload.definitionId = definitionId
    context.payload.relationshipChain = [partUri]
    context.payload.declarationIds = [definitionId, 'provider']
    instance.definitionId = definitionId
    instance.relationshipChain = [partUri]
  }
  return document
}
