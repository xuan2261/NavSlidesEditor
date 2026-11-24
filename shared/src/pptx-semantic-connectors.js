const {
  semanticDefinition,
  semanticDefinitions,
  semanticInstance,
  semanticInstances,
  semanticStyle,
  semanticStyles,
  replaceSemanticRecords,
} = require('./pptx-semantic-records.js')

// The caller owns plain-data cloning and structural ancestry validation.
// Bindings are occurrence state; native endpoint identities are immutable source data.
const { IDENTITY, multiply, invert, transformPoint } = require('./pptx-affine.js')
const { deriveGeometryPaths } = require('./pptx-geometry-document.js')
const { geometryProvider } = require('./pptx-geometry-style-records.js')
const { structuralGeometry, materializeGeometry } = require('./pptx-geometry-style-resolution.js')
const ends = ['start', 'end']
const fail = (message) => {
  throw new TypeError(`Invalid semantic connector: ${message}`)
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 1024
const index = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 255
function geometry(document, instance) {
  return structuralGeometry(document, instance.id)
}
function connector(definition, effective = definition.content.geometry) {
  return definition.kind === 'connector' || effective?.connector !== undefined
}
function providerPlacement(document, instance) {
  if (document.schemaVersion !== 2 && document.schemaVersion !== 3) return instance.relationshipChain ?? []
  const context = (
    semanticStyle(document, instance.sourceBinding?.contextId) ??
    document.styles?.[instance.sourceBinding?.contextId]
  )?.payload
  if (!context) return instance.relationshipChain ?? []
  const part = geometryProvider(document, instance).definition.source.partUri
  const parts = [context.hostSlidePartUri, ...context.edges.map((edge) => edge.toPartUri)]
  const index = parts.indexOf(part)
  if (index < 0) fail('geometry provider outside source context')
  return [
    context.hostSlidePartUri,
    ...context.edges.slice(0, index).map((edge) => edge.relationshipId),
  ]
}
function active(document, instanceId) {
  const instance = semanticInstance(document, instanceId) ?? document.instances?.[instanceId]
  if (!instance || instance.lineage?.tombstone === true) fail('missing or inactive target')
  return instance
}
function world(document, instanceId) {
  const ancestry = []
  while (instanceId !== null) {
    const instance = active(document, instanceId)
    ancestry.push(instance.localTransform)
    instanceId = instance.parentInstanceId
  }
  return ancestry.reverse().reduce((matrix, local) => multiply(matrix, local), IDENTITY)
}
function site(targetGeometry, siteIndex, structural = false) {
  if (!index(siteIndex) || !targetGeometry?.connections?.[siteIndex]) fail('nonexistent site')
  if (structural) return
  // Connection positions are native shape-local coordinates, never path-grid units.
  return deriveGeometryPaths(targetGeometry).connections[siteIndex].position
}
function connectorEndpointLocators(value) {
  const commands = value.paths?.[0]?.commands
  if (
    value.paths?.length !== 1 ||
    !commands ||
    commands.length < 2 ||
    commands[0].kind !== 'moveTo' ||
    commands[0].points?.length !== 1 ||
    commands.slice(1).some((command) => {
      const count = { lnTo: 1, quadBezTo: 2, cubicBezTo: 3 }[command.kind]
      return !count || command.points?.length !== count
    })
  )
    return null
  const commandIndex = commands.length - 1
  const pointIndex = commands[commandIndex].points.length - 1
  return {
    start: {
      pathIndex: 0,
      commandIndex: 0,
      pointIndex: 0,
      componentId: commands[0].points[0].componentId,
    },
    end: {
      pathIndex: 0,
      commandIndex,
      pointIndex,
      componentId: commands[commandIndex].points[pointIndex].componentId,
    },
  }
}
function route(value) {
  const endpoints = connectorEndpointLocators(value)
  if (!endpoints) fail('unsupported connector route')
  return endpoints
}
function validateSource(document, definition) {
  const native = definition.content.geometry?.connector
  if (!record(native) || Object.keys(native).some((key) => !ends.includes(key)))
    fail('native endpoint record')
  for (const endpoint of Object.values(native)) {
    if (
      !record(endpoint) ||
      Object.keys(endpoint).length !== 4 ||
      !['shapeId', 'index', 'targetDefinitionId', 'componentId'].every((key) =>
        Object.hasOwn(endpoint, key)
      ) ||
      !id(endpoint.shapeId) ||
      endpoint.shapeId.length > 256 ||
      !id(endpoint.targetDefinitionId) ||
      !id(endpoint.componentId) ||
      !index(endpoint.index) ||
      !definition.components.some(
        (component) => component.id === endpoint.componentId && component.kind === 'connection'
      )
    )
      fail('native endpoint identity/component')
    const target = semanticDefinition(document, endpoint.targetDefinitionId) ?? document.definitions?.[endpoint.targetDefinitionId]
    if (
      !target ||
      connector(target) ||
      target.source?.partUri !== definition.source?.partUri ||
      target.source?.nativeId !== endpoint.shapeId
    )
      fail('native target identity/part')
    let providers
    if (target.content?.geometry) {
      providers = [target.content.geometry]
    } else {
      providers = []
      for (const [, style] of semanticStyles(document, { kind: 'geometry-context' })) {
        if (style.kind === 'geometry-context' && style.payload.definitionId === target.id) {
          const geomDef = semanticDefinition(document, style.payload.geometry.definitionId) ?? document.definitions?.[style.payload.geometry.definitionId]
          if (geomDef?.content?.geometry) providers.push(geomDef.content.geometry)
        }
      }
    }
    if (!providers.length) fail('missing native target geometry')
    for (const provider of providers) site(provider, endpoint.index, provider.schemaVersion === 2 || provider.schemaVersion === 3)
  }
}
function validateInstance(document, instance) {
  const { definition, geometry: source } = geometryProvider(document, instance)
  if (!connector(definition, source)) {
    if (instance.connectorBindings !== undefined) fail('bindings on nonconnector')
    return
  }
  const effective = geometry(document, instance)
  const bindings = instance.connectorBindings
  if (
    !record(bindings) ||
    Object.keys(bindings).some((key) => !ends.includes(key)) ||
    Object.keys(source.connector).some((key) => !Object.hasOwn(bindings, key))
  )
    fail('incomplete occurrence bindings')
  if (
    !record(effective.connector) ||
    Object.keys(effective.connector).length !== Object.keys(source.connector).length ||
    Object.entries(source.connector).some(
      ([end, endpoint]) =>
        !record(effective.connector[end]) ||
        Object.keys(effective.connector[end]).length !== 4 ||
        Object.entries(endpoint).some(([key, value]) => effective.connector[end][key] !== value)
    )
  )
    fail('native endpoint override')
  for (const binding of Object.values(bindings)) {
    if (binding === null) continue
    if (
      !record(binding) ||
      Object.keys(binding).length !== 2 ||
      !id(binding.targetInstanceId) ||
      !index(binding.index)
    )
      fail('occurrence binding')
    const target = active(document, binding.targetInstanceId)
    const targetProvider = geometryProvider(document, target)
    const targetDefinition = targetProvider.definition
    const placement = providerPlacement(document, instance),
      targetPlacement = providerPlacement(document, target)
    if (
      target.lineage?.paintOnly === true ||
      connector(targetDefinition, targetProvider.geometry) ||
      target.slideId !== instance.slideId ||
      targetDefinition.source?.partUri !== definition.source?.partUri ||
      !Array.isArray(placement) ||
      !Array.isArray(targetPlacement) ||
      placement.length !== targetPlacement.length ||
      placement.some((value, offset) => value !== targetPlacement[offset])
    )
      fail('target slide/part/placement')
    world(document, target.id)
    site(geometry(document, target), binding.index)
    route(effective)
  }
}
function validateConnectorBindings(document) {
  for (const [, definition] of semanticDefinitions(document))
    if (connector(definition)) validateSource(document, definition)
  for (const [, instance] of semanticInstances(document)) {
    if (instance.lineage?.tombstone === true) continue
    validateInstance(document, instance)
  }
}
function deriveConnectorGeometry(document, instanceId) {
  const instance = active(document, instanceId)
  const { definition, geometry: source } = geometryProvider(document, instance)
  if (!connector(definition, source)) fail('instance is not a connector')
  validateSource(document, definition)
  validateInstance(document, instance)
  const derived =
    (document.schemaVersion === 2 || document.schemaVersion === 3)
      ? materializeGeometry(document, instanceId)
      : structuredClone(geometry(document, instance))
  const bound = ends.filter((end) => instance.connectorBindings[end] != null)
  if (!bound.length) return derived
  const inverse = invert(world(document, instanceId)),
    path = derived.paths[0],
    endpoints = route(derived)
  for (const end of bound) {
    const binding = instance.connectorBindings[end]
    const target = active(document, binding.targetInstanceId)
    const position = transformPoint(
      multiply(inverse, world(document, target.id)),
      site(geometry(document, target), binding.index)
    )
    const endpoint = endpoints[end]
    const point = path.commands[endpoint.commandIndex].points[endpoint.pointIndex]
    delete point.localOffset
    for (const axis of ['x', 'y']) {
      const dimension = axis === 'x' ? 'width' : 'height'
      const scale = path[dimension] === undefined ? 1 : derived[dimension] / path[dimension]
      if (scale === 0) {
        point[axis] = 0
        point.localOffset ??= { x: 0, y: 0 }
        point.localOffset[axis] = position[axis]
      } else {
        point[axis] = position[axis] / scale
        if (!Number.isFinite(point[axis])) fail('unrepresentable endpoint')
      }
    }
  }
  return derived
}
function detachConnectorBindingsFromTargets(document, targetInstanceIds) {
  const targets = new Set(targetInstanceIds)
  const patch = {}
  for (const [id, instance] of semanticInstances(document)) {
    if (instance.lineage?.tombstone || !instance.connectorBindings) continue
    const affected = Object.entries(instance.connectorBindings).filter(
      ([, binding]) => binding && targets.has(binding.targetInstanceId)
    )
    if (!affected.length) continue
    const resolved = deriveConnectorGeometry(document, id)
    const geometry = structuralGeometry(document, id)
    const locators = connectorEndpointLocators(resolved)
    if (!locators) fail('unsupported connector route')
    const frozen = structuredClone(geometry)
    for (const [end] of affected) {
      const endpoint = locators[end]
      frozen.paths[endpoint.pathIndex].commands[endpoint.commandIndex].points[endpoint.pointIndex] =
        structuredClone(
          resolved.paths[endpoint.pathIndex].commands[endpoint.commandIndex].points[
            endpoint.pointIndex
          ]
        )
    }
    if (document.schemaVersion === 2 || document.schemaVersion === 3) delete frozen.style
    const componentId = geometryProvider(document, instance).geometry.componentId
    const previous = instance.overrides.components?.[componentId] ?? {}
    const connectorBindings = { ...instance.connectorBindings }
    for (const [end] of affected) connectorBindings[end] = null
    patch[id] = {
      ...instance,
      connectorBindings,
      overrides: {
        ...instance.overrides,
        components: {
          ...instance.overrides.components,
          [componentId]: {
            ...previous,
            geometryDocument: require('./pptx-geometry-document.js').normalizeGeometryDocument(
              frozen
            ),
          },
        },
      },
    }
  }
  return replaceSemanticRecords(document, { instances: patch })
}
module.exports = {
  validateConnectorBindings,
  deriveConnectorGeometry,
  detachConnectorBindingsFromTargets,
  providerPlacement,
  connectorEndpointLocators,
}
module.exports.default = module.exports
