// Synthetic validated linked connector graph, not native qualification.
import { inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

export function linkedConnectorFixture() {
  const document = inheritedGeometryStyleFixture()
  const provider = document.definitions.definition
  provider.content.geometry.connections = [
    { componentId: 'site', angle: 0, position: { x: 'w', y: 'h' } },
  ]
  provider.components.push({
    id: 'site',
    kind: 'connection',
    locator: { path: [0, 0, 6], preconditionHash: provider.source.preconditionHash },
  })
  const source = structuredClone(provider)
  source.id = 'connectorSource'
  source.source.nativeId = '4'
  source.source.componentLocator.path = [0, 1]
  source.components = [
    {
      id: 'connectorGeometry',
      kind: 'property',
      locator: { path: [0, 1, 0], preconditionHash: source.source.preconditionHash },
    },
    {
      id: 'startConnection',
      kind: 'connection',
      locator: { path: [0, 1, 1], preconditionHash: source.source.preconditionHash },
    },
  ]
  source.content = {
    geometrySource: { styleId: 'connectorDeclarations' },
    geometry: {
      schemaVersion: 1,
      componentId: 'connectorGeometry',
      kind: 'custom',
      width: 100,
      height: 80,
      paths: [
        {
          componentId: 'connectorPath',
          width: 1000,
          height: 800,
          commands: [
            { kind: 'moveTo', points: [{ componentId: 'connectorStart', x: 0, y: 0 }] },
            { kind: 'lnTo', points: [{ componentId: 'connectorEnd', x: 1000, y: 800 }] },
          ],
        },
      ],
      connector: {
        start: {
          shapeId: '2',
          index: 0,
          targetDefinitionId: 'definition',
          componentId: 'startConnection',
        },
      },
    },
  }
  document.definitions.connectorSource = source
  const declarations = structuredClone(document.styles.provider)
  function relocate(value) {
    if (!value || typeof value !== 'object') return
    if (value.source?.componentLocator) value.source.componentLocator.path[1] = 1
    for (const entry of Object.values(value)) relocate(entry)
  }
  relocate(declarations)
  declarations.payload.definitionId = source.id
  declarations.payload.geometry = { definitionId: source.id, componentId: 'connectorGeometry' }
  delete declarations.payload.placeholder
  document.styles.connectorDeclarations = declarations
  const context = structuredClone(document.styles.context1)
  context.source = {
    partUri: source.source.partUri,
    preconditionHash: source.source.preconditionHash,
    componentLocator: source.source.componentLocator,
  }
  context.payload.definitionId = source.id
  context.payload.geometry = declarations.payload.geometry
  context.payload.declarationIds = ['connectorDeclarations']
  context.payload.transformDeclarationIds = ['connectorDeclarations']
  context.payload.relationshipChain = ['ppt/slides/slide1.xml', 'rLayout']
  document.styles.connectorContext = context
  document.instances.connector = {
    id: 'connector',
    definitionId: source.id,
    slideId: 's1',
    parentInstanceId: null,
    localTransform: [1, 0, 0, 1, 0, 0],
    paintIndex: 1,
    relationshipChain: context.payload.relationshipChain,
    sourceBinding: { contextId: 'connectorContext' },
    overrides: {},
    connectorBindings: { start: { targetInstanceId: 'i1', index: 0 } },
  }
  return document
}

export function linkedCurveConnectorFixture() {
  const document = linkedConnectorFixture()
  for (const id of ['definition', 'connectorSource']) {
    const geometry = document.definitions[id].content.geometry
    geometry.schemaVersion = 2
    delete geometry.width
    delete geometry.height
  }
  const path = document.definitions.connectorSource.content.geometry.paths[0]
  path.commands[1] = {
    kind: 'cubicBezTo',
    points: [
      { componentId: 'curveControl1', x: 200, y: 20 },
      { componentId: 'curveControl2', x: 700, y: 600 },
      { componentId: 'connectorEnd', x: 1000, y: 800 },
    ],
  }
  document.instances.connector.connectorBindings.end = { targetInstanceId: 'i1', index: 0 }
  return document
}
