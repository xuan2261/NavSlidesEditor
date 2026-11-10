const {
  validateTextContextData,
  fields,
  sourcePath,
  fail,
  same,
} = require('./pptx-semantic-text-context-data')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')

// This validates source structure, not trust. Server saves compare these records
// against the authoritative baseline; a detached caller snapshot grants nothing.
function validateTextContextRecord(document, styleId, entry, checkedSource, expansionBudget, indices = {}) {
  const context = expandTextContext(entry.payload, { ...expansionBudget, styles: document.styles })
  fields(context, [
    'schemaVersion',
    'occurrenceId',
    'definitionId',
    'hostSlidePartUri',
    'bindings',
    'relationships',
    'provenance',
    'theme',
    'body',
    'paragraphs',
    'fontRequests',
  ])
  if (context.schemaVersion !== 1 || styleId !== `text-context:${context.occurrenceId}`)
    fail('context identity/version')
  const definition = document.definitions[context.definitionId]
  const chart =
    definition?.kind === 'chart' &&
    (definition.origin === undefined || definition.origin === 'source') &&
    definition.content.chartDocument?.source?.ownerDefinitionId === definition.id
  const own = chart
    ? {
        partUri: definition.source?.partUri,
        preconditionHash: definition.source?.preconditionHash,
        componentLocator: definition.source?.componentLocator,
      }
    : document.styles[definition?.content.geometrySource?.styleId]?.source
  if (
    (!chart && !definition?.content.textDocument && !definition?.content.ommlDocument) ||
    !own ||
    !same(own, entry.source)
  )
    fail('definition owner')
  if (chart) {
    checkedSource(own)
    if (definition.content.textDocument || definition.content.ommlDocument) fail('chart text owner')
  }
  fields(context.bindings, ['layoutDefinitionId', 'masterDefinitionId'])
  if (chart) {
    fields(context.body, ['target', 'entries'])
    if (
      context.bindings.layoutDefinitionId !== null ||
      context.bindings.masterDefinitionId !== null ||
      !same(context.body.target, {}) ||
      !Array.isArray(context.body.entries) ||
      context.body.entries.length ||
      !Array.isArray(context.paragraphs) ||
      context.paragraphs.length
    )
      fail('chart shape inheritance')
  }
  if (!Array.isArray(context.relationships) || context.relationships.length !== 4)
    fail('relationship chain')
  const parts = ['ppt/presentation.xml']
  for (const [index, edge] of context.relationships.entries()) {
    fields(edge, [
      'ownerPartUri',
      'relationshipId',
      'type',
      'targetPartUri',
      'source',
      'preconditionHash',
    ])
    const path = sourcePath(edge.source)
    checkedSource({
      partUri: edge.source.part,
      preconditionHash: edge.preconditionHash,
      componentLocator: { path, preconditionHash: edge.preconditionHash },
    })
    const kind = ['slide', 'slideLayout', 'slideMaster', 'theme'][index]
    if (
      edge.ownerPartUri !== parts[index] ||
      parts.includes(edge.targetPartUri) ||
      typeof edge.relationshipId !== 'string' ||
      !edge.relationshipId.length ||
      ![
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'http://purl.oclc.org/ooxml/officeDocument/relationships',
      ].some((base) => edge.type === `${base}/${kind}`) ||
      edge.source.part !== edge.ownerPartUri.replace(/([^/]+)$/, '_rels/$1.rels') ||
      path.length !== 2 ||
      path[0] !== 0
    )
      fail('relationship edge')
    parts.push(edge.targetPartUri)
  }
  const sourceIndex = parts.indexOf(definition.source.partUri)
  const chain = [
    parts[1],
    ...context.relationships.slice(1, sourceIndex).map((e) => e.relationshipId),
  ]
  if (
    sourceIndex < 1 ||
    sourceIndex > 3 ||
    context.hostSlidePartUri !== parts[1] ||
    context.occurrenceId !== `${parts[1]}@${chain.join('>')}#${definition.id}`
  )
    fail('occurrence lineage')
  const lookupKey = `${definition.id}|${context.hostSlidePartUri}|${chain.join('>')}`
  const geometryContexts = indices.geometryContextsByKey
    ? (indices.geometryContextsByKey.get(lookupKey) ?? [])
    : Object.values(document.styles).filter(
        (record) =>
          record.kind === 'geometry-context' &&
          record.payload.definitionId === definition.id &&
          record.payload.hostSlidePartUri === context.hostSlidePartUri &&
          same(record.payload.relationshipChain, chain)
      )
  if (
    !chart &&
    (geometryContexts.length !== 1 ||
      !same(
        geometryContexts[0].payload.edges,
        context.relationships.slice(1).map((edge) => ({
          fromPartUri: edge.ownerPartUri,
          toPartUri: edge.targetPartUri,
          relationshipId: edge.relationshipId,
          type: edge.type,
          source: {
            partUri: edge.source.part,
            preconditionHash: edge.preconditionHash,
            componentLocator: {
              path: sourcePath(edge.source),
              preconditionHash: edge.preconditionHash,
            },
          },
        }))
      ))
  )
    fail('linked geometry relationship lineage')
  const owners = { own, definition, parts }
  for (const [name, partIndex] of [
    ['layout', 2],
    ['master', 3],
  ]) {
    const id = context.bindings[`${name}DefinitionId`]
    if (id === null) continue
    const provider = document.definitions[id]
    const source = document.styles[provider?.content.geometrySource?.styleId]?.source
    if (
      sourceIndex >= partIndex ||
      (!provider?.content.textDocument && !provider?.content.ommlDocument) ||
      provider.source.partUri !== parts[partIndex] ||
      !geometryContexts[0].payload.declarationIds.includes(
        provider.content.geometrySource?.styleId
      ) ||
      !source
    )
      fail('provider binding')
    owners[name] = source
  }
  validateTextContextData(context, owners, checkedSource)
  if (chart) {
    if (
      parts
        .slice(0, 4)
        .some(
          (part) =>
            context.provenance.filter(
              (receipt) => receipt.source.part === part && receipt.source.path === '0'
            ).length !== 1
        )
    )
      fail('chart root provenance')
    if (
      !Object.values(document.instances).some(
        (instance) => instance.textSourceBinding?.contextId === styleId
      )
    )
      fail('unbound chart text context')
  }
  return chart
}

function validateTextContextBindings(document) {
  for (const definition of Object.values(document.definitions))
    if (definition.content.ommlDocument && definition.content.mathFrame?.textContext !== undefined)
      fail('derived equation context cannot be persisted')
  if (document.schemaVersion === 3) {
    const { semanticRecords, semanticDefinition } = require('./pptx-semantic-records.js')
    const contextsByEligibleKey = new Map()
    for (const [id, record] of semanticRecords(document, 'styles', { kind: 'text-context' })) {
      const key = `${record.payload.definitionId}|${record.payload.hostSlidePartUri}`
      if (!contextsByEligibleKey.has(key)) contextsByEligibleKey.set(key, [])
      contextsByEligibleKey.get(key).push([id, record])
    }
    for (const [, instance] of semanticRecords(document, 'instances')) {
      const key = `${instance.definitionId}|${instance.relationshipChain?.[0]}`
      const eligible = contextsByEligibleKey.get(key) ?? []
      const binding = instance.textSourceBinding
      if (binding === undefined) {
        if (eligible.length) fail('missing occurrence text binding')
        continue
      }
      fields(binding, ['contextId'])
      if (!eligible.some(([id]) => id === binding.contextId)) fail('occurrence text binding')
      const context = eligible.find(([id]) => id === binding.contextId)[1].payload
      const def = semanticDefinition(document, instance.definitionId)
      const sourceIndex = context.relationships.findIndex(
        (edge) => edge.targetPartUri === def?.source?.partUri
      )
      const chain = [
        context.hostSlidePartUri,
        ...context.relationships.slice(1, sourceIndex + 1).map((edge) => edge.relationshipId),
      ]
      if (!same(chain, instance.relationshipChain)) fail('occurrence text relationship chain')
    }
    return
  }
  const contexts = Object.entries(document.styles).filter(
    ([, record]) => record.kind === 'text-context'
  )
  if (document.schemaVersion !== 2) {
    if (
      contexts.length ||
      Object.values(document.styles).some((record) => record.kind === 'text-context-resources') ||
      Object.values(document.instances).some((i) => i.textSourceBinding !== undefined)
    )
      fail('linked contexts require schema two')
    return
  }
  const contextsByEligibleKey = new Map()
  for (const [id, record] of contexts) {
    const key = `${record.payload.definitionId}|${record.payload.hostSlidePartUri}`
    if (!contextsByEligibleKey.has(key)) contextsByEligibleKey.set(key, [])
    contextsByEligibleKey.get(key).push([id, record])
  }
  for (const instance of Object.values(document.instances)) {
    const key = `${instance.definitionId}|${instance.relationshipChain?.[0]}`
    const eligible = contextsByEligibleKey.get(key) ?? []
    const binding = instance.textSourceBinding
    if (binding === undefined) {
      if (eligible.length) fail('missing occurrence text binding')
      continue
    }
    fields(binding, ['contextId'])
    if (!eligible.some(([id]) => id === binding.contextId)) fail('occurrence text binding')
    const context = document.styles[binding.contextId].payload
    const sourceIndex = context.relationships.findIndex(
      (edge) => edge.targetPartUri === document.definitions[instance.definitionId].source.partUri
    )
    const chain = [
      context.hostSlidePartUri,
      ...context.relationships.slice(1, sourceIndex + 1).map((edge) => edge.relationshipId),
    ]
    if (!same(chain, instance.relationshipChain)) fail('occurrence text relationship chain')
  }
}
module.exports = { validateTextContextRecord, validateTextContextBindings }
