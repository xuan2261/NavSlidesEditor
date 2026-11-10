const ID_FIELDS = new Set([
  'id', 'componentId', 'definitionId', 'contextId', 'declarationIds',
  'transformDeclarationIds', 'occurrenceId', 'styleId', 'resourcesId',
  'anchorCellId', 'parentInstanceId', 'declarationId', 'masterDefinitionId',
  'layoutDefinitionId', 'paintComponentId', 'parentDefinitionId',
  'ownerDefinitionId', 'targetDefinitionId', 'targetInstanceId',
  'themeId', 'colorMapIds', 'bindingId', 'baseStyleId',
])
const PROPERTY_FIELDS = new Set([
  'properties', 'fontLatin', 'fontEastAsian', 'fontComplexScript', 'borders',
  'paragraphProperties', 'runProperties', 'styleRefs', 'target', 'extent',
  'frameProperties', 'color', 'fill', 'stroke',
])
const CATALOGS = [
  'partUris', 'sourceParts', 'sourceLocations', 'sourceIdentities',
  'typedPropertyValues', 'sourceRelationships', 'fontDescriptors',
  'declarationScopes', 'textShapes', 'textInventories',
]
const dictionaryKinds = new Set(['definitions', 'instances', 'styles', 'components'])
const indices = new WeakMap()
const decodedRecords = new WeakMap()
const decodedResources = new WeakMap()
const certifiedImmutableDocuments = new WeakSet()
// Only roots allocated and recursively frozen by the checked clone qualify.
// This proof grants no successful-normalization status or decoding cache yet.
const immutableCloneRoots = new WeakSet()
const AUTHORITY_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'sourceAuthority',
  'sourceRef',
  'sourceMap',
  'packagePath',
  'originalPath',
  'packageRevisionId',
  'aggregateGeneration',
  'fencingEpoch',
  'adapterQualified',
  'transactionEligible',
  'level4Promoted',
  'controlCapabilityHash',
  'capabilityHash',
])

function cloneImmutableSemanticDocument(input, limits, ErrorType = TypeError) {
  function fail(message) { throw new ErrorType(message) }
  let nodes = 0
  const ancestors = new Set()
  function clone(value, depth = 0) {
    if (value && typeof value === 'object') {
      if (ancestors.has(value)) fail('Semantic content cycle')
      if (immutableCloneRoots.has(value)) return value
    }
    if (depth > limits.maxDepth || ++nodes > limits.maxInstances + limits.maxComponents * 10) {
      fail('Semantic data budget exceeded')
    }
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('Invalid numeric value in semantic data/transform')
      return value
    }
    if (!value || typeof value !== 'object') fail('Semantic content must be JSON data')
    if (Array.isArray(value)) {
      if (value.length > limits.maxComponents) fail('Semantic array budget exceeded')
      if (Reflect.ownKeys(value).filter((key) => key !== 'length').length !== value.length) {
        fail('Invalid sparse semantic array')
      }
    }
    const prototype = Object.getPrototypeOf(value)
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
      fail('Semantic content must be a plain data record')
    }
    ancestors.add(value)
    const result = Array.isArray(value) ? [] : {}
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue
      if (typeof key !== 'string' || AUTHORITY_KEYS.has(key))
        fail('Forbidden semantic authority key')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        fail('Semantic content must use enumerable data property')
      }
      if (Array.isArray(value) && !/^(?:0|[1-9]\d*)$/.test(key)) fail('Invalid semantic array key')
      result[key] = clone(descriptor.value, depth + 1)
    }
    ancestors.delete(value)
    const frozen = Object.freeze(result)
    immutableCloneRoots.add(frozen)
    return frozen
  }
  const document = clone(input)
  if (document && typeof document === 'object') {
    immutableCloneRoots.add(document)
    if (decodedRecords.has(input)) decodedRecords.set(document, decodedRecords.get(input))
    if (decodedResources.has(input)) decodedResources.set(document, decodedResources.get(input))
    if (indices.has(input)) indices.set(document, indices.get(input))
  }
  return document
}

function isDeeplyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return true
  if (!Object.isFrozen(value)) return false
  if (seen.has(value)) return true
  seen.add(value)
  const proto = Object.getPrototypeOf(value)
  if (proto !== null && proto !== Object.prototype && proto !== Array.prototype) {
    return false
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    const desc = descriptors[key]
    if (desc) {
      if (desc.get || desc.set) return false
      if (desc.value && typeof desc.value === 'object') {
        if (!isDeeplyFrozen(desc.value, seen)) return false
      }
    }
  }
  return true
}

function certifyImmutableSemanticDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new TypeError('Invalid semantic document: expected plain document object')
  }
  if (certifiedImmutableDocuments.has(document)) {
    return document
  }
  if (!immutableCloneRoots.has(document) && !isDeeplyFrozen(document)) {
    throw new TypeError('Cannot certify mutable or shallow-frozen semantic document as immutable')
  }
  certifiedImmutableDocuments.add(document)
  immutableCloneRoots.delete(document)
  return document
}

function isCertifiedSemanticDocument(document) {
  return document !== null && typeof document === 'object' && certifiedImmutableDocuments.has(document)
}
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const textEncoder = new TextEncoder()
const bytes = (value) => {
  const json = JSON.stringify(value)
  return typeof Buffer !== 'undefined'
    ? Buffer.byteLength(json, 'utf8')
    : textEncoder.encode(json).byteLength
}
function invalid(message) { throw new TypeError(`Invalid semantic graph: ${message}`) }
function at(values, index, name) {
  if (!Array.isArray(values) || !Number.isSafeInteger(index) || index < 0 || index >= values.length) invalid(`${name} reference`)
  return values[index]
}
function validateGraphStructure(document) {
  if (!document || document.schemaVersion !== 3) return
  for (const catalog of CATALOGS) {
    if (!Array.isArray(document[catalog])) invalid(`Invalid semantic ${catalog} catalog`)
  }
  for (const part of document.sourceParts) {
    if (!part || typeof part !== 'object' || Array.isArray(part)) invalid('sourceParts entry')
    if (!part.partUri || typeof part.partUri !== 'object' || !Number.isSafeInteger(part.partUri.partId)) invalid('sourceParts partUri')
    at(document.partUris, part.partUri.partId, 'part URI')
    if (typeof part.preconditionHash !== 'string' || !/^[a-f0-9]{64}$/.test(part.preconditionHash)) invalid('sourceParts preconditionHash')
  }
  for (const loc of document.sourceLocations) {
    if (!loc || typeof loc !== 'object' || Array.isArray(loc)) invalid('sourceLocations entry')
    at(document.sourceParts, loc.part, 'source part')
    if (!Array.isArray(loc.path) || !loc.path.length || loc.path.some((n) => !Number.isSafeInteger(n) || n < 0)) invalid('sourceLocations path')
  }
  for (const scope of document.declarationScopes) {
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) invalid('declarationScopes entry')
    if (scope.parent !== null && scope.parent !== undefined) {
      if (!Number.isSafeInteger(scope.parent) || scope.parent < 0 || scope.parent >= document.declarationScopes.length || !document.declarationScopes[scope.parent]) {
        invalid('Dangling declaration scope parent')
      }
    }
  }

  for (let i = 0; i < document.declarationScopes.length; i++) {
    let p = document.declarationScopes[i].parent
    let d = 0
    const path = new Set([i])
    while (p !== null && p !== undefined) {
      if (path.has(p) || ++d > 256) invalid('Semantic scope cycle/depth exceeded')
      path.add(p)
      p = document.declarationScopes[p].parent
    }
  }
}
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function semanticIdentity(document, reference) {
  if (typeof reference === 'string') return reference
  if (document?.schemaVersion !== 3 || !Number.isSafeInteger(reference) || reference < 0) return undefined
  const value = document.sourceIdentities?.[reference]
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return undefined
  if (value.length === 3) {
    const part = document.partUris?.[value[0]]
    return typeof part === 'string' ? `${part}#${value[1]}:${value[2]}` : undefined
  }
  if (value.length === 4 && value[3] === 'text-context') {
    const part = document.partUris?.[value[0]]
    return typeof part === 'string' ? `text-context:${part}#${value[1]}:${value[2]}` : undefined
  }
  return undefined
}
function indexFor(document) {
  let index = indices.get(document)
  if (!index) {
    index = new Map()
    const identities = document.sourceIdentities
    if (Array.isArray(identities)) {
      for (let i = 0; i < identities.length; i++) {
        const id = semanticIdentity(document, i)
        if (typeof id !== 'string' || !id.length || index.has(id)) invalid('identity inventory')
        index.set(id, i)
      }
    }
    indices.set(document, index)
  }
  return index
}
function recordKey(document, id) {
  return typeof id === 'number' ? id : indexFor(document).get(id) ?? id
}
function evaluationBudget() {
  let visited = 0, size = 0
  return {
    snapshot() { return { visited, size } },
    replay(cost) {
      visited += cost.visited
      size += cost.size
      if (visited > 1100000) invalid('evaluation visited-value budget')
      if (size > 8388608) invalid('evaluation byte budget')
    },
    visit(depth) {
      if (depth > 256) invalid('evaluation depth')
      if (++visited > 1100000) invalid('evaluation visited-value budget')
    },
    charge(value) {
      size += value
      if (size > 8388608) invalid('evaluation byte budget')
    },
  }
}
function decodeValue(document, value, field = '', depth = 0, budget = evaluationBudget(), inGuide = false) {
  budget.visit(depth)
  if (Array.isArray(value)) {
    budget.charge(2 + Math.max(0, value.length - 1))
    if (field === 'edges' || field === 'relationships') {
      return value.map((ref) => {
        if (typeof ref === 'object' && ref !== null) return decodeValue(document, ref, field, depth + 1, budget, inGuide)
        const relation = at(document.sourceRelationships, ref, 'relationship')
        if (relation.kind !== field) invalid('relationship kind')
        return decodeValue(document, relation.value, field, depth + 1, budget, inGuide)
      })
    }
    return value.map((child) => decodeValue(document, child, field, depth + 1, budget, inGuide))
  }
  if (plain(value)) {
    const keys = Object.keys(value)
    if (keys.length === 1 && own(value, 'partId')) {
      const result = at(document.partUris, value.partId, 'part URI')
      budget.charge(bytes(result))
      return result
    }
    if (keys.length === 1 && own(value, 'valueId')) {
      const property = at(document.typedPropertyValues, value.valueId, 'property')
      if (property.kind !== field || !PROPERTY_FIELDS.has(field)) invalid('property kind')
      return decodeValue(document, property.value, field, depth + 1, budget, inGuide)
    }
    for (const [ref, kind] of [['sourceId', 'source'], ['textSourceId', 'text'], ['locatorId', 'locator']]) {
      if (keys.length !== 1 || !own(value, ref)) continue
      const location = at(document.sourceLocations, value[ref], 'source location')
      const part = at(document.sourceParts, location.part, 'source part')
      const { part: _omitted, ...locator } = location
      const partUri = decodeValue(document, part.partUri, '', depth + 1, budget, inGuide)
      const result = kind === 'text'
        ? { part: partUri, path: Array.isArray(locator.path) ? locator.path.join('.') : locator.path }
        : kind === 'locator'
          ? { ...locator, preconditionHash: part.preconditionHash }
          : { ...part, partUri, componentLocator: { ...locator, preconditionHash: part.preconditionHash } }
      return decodeValue(document, result, '', depth + 1, budget, inGuide)
    }
    const result = {}
    budget.charge(2 + Math.max(0, keys.length - 1))
    for (const [key, child] of Object.entries(value)) {
      const decodedKey = dictionaryKinds.has(field) && /^(0|[1-9]\d*)$/.test(key)
        ? semanticIdentity(document, Number(key)) : key
      if (decodedKey === undefined) invalid('dictionary identity')
      budget.charge(bytes(decodedKey) + 1)
      Object.defineProperty(result, decodedKey, { value: decodeValue(document, child, key, depth + 1, budget, inGuide || key === 'sourceGuideList' || key === 'guides'), enumerable: true, writable: true, configurable: true })
    }
    return result
  }
  if (Number.isSafeInteger(value) && ID_FIELDS.has(field) && (!inGuide || field !== 'id')) {
    const id = semanticIdentity(document, value)
    if (id === undefined) invalid('identity reference')
    budget.charge(bytes(id))
    return id
  }
  budget.charge(bytes(value))
  return value
}
function scopeRecords(document, scope) {
  const result = [], seen = new Set()
  while (scope !== null) {
    if (seen.has(scope) || seen.size >= 256) invalid('declaration scope cycle/depth exceeded')
    seen.add(scope)
    const node = at(document.declarationScopes, scope, 'declaration scope')
    result.push(node.declaration)
    scope = node.parent
  }
  return result
}
function contextLayerSets(context) {
  const sets = [context.body]
  for (const paragraph of context.paragraphs) {
    sets.push(paragraph.paragraph, paragraph.run)
    for (const run of paragraph.runs) sets.push(run.layers)
  }
  return sets
}
function resourceValue(document, pool, id, kind, budget = evaluationBudget()) {
  if (Number.isSafeInteger(id) && id >= 0) id = `record-${id}`
  if (typeof id !== 'string' || !/^record-(0|[1-9]\d*)$/.test(id)) invalid('resource identity')
  const resource = pool.payload.records[id]
  if (!resource || resource.kind !== kind) invalid('resource kind/reference')
  const certified = certifiedImmutableDocuments.has(document)
  let pools = certified ? decodedResources.get(document) : undefined
  let resources = pools?.get(pool)
  const cached = resources?.get(id)
  if (cached) {
    budget.replay(cached.cost)
    return cached.value
  }
  const before = certified ? budget.snapshot() : null
  let wire = resource.value
  if (kind === 'font' && wire.descriptorId !== undefined) {
    const descriptor = at(document.fontDescriptors, wire.descriptorId, 'font descriptor')
      const { descriptorId: _descriptorId, ...source } = wire
    wire = { ...descriptor, ...source }
  }
  let value = decodeValue(document, wire, '', 0, budget)
  if (kind === 'font' && value.descriptorId !== undefined) {
    invalid('font descriptor reference')
  } else if (kind === 'provenance' && value.preconditionHash === undefined) {
    const location = at(document.sourceLocations, resource.value.source.textSourceId, 'provenance source')
    value.preconditionHash = at(document.sourceParts, location.part, 'provenance part').preconditionHash
  }
  if (certified) {
    const after = budget.snapshot()
    if (!pools) {
      pools = new WeakMap()
      decodedResources.set(document, pools)
    }
    if (!resources) {
      resources = new Map()
      pools.set(pool, resources)
    }
    resources.set(id, { value: freeze(value), cost: {
      visited: after.visited - before.visited,
      size: after.size - before.size,
    } })
  }
  return value
}
function decodeContext(document, wire, budget = evaluationBudget()) {
  const shape = at(document.textShapes, wire.shape, 'text shape')
  const context = decodeValue(document, { ...shape, ...wire }, '', 0, budget)
  delete context.shape
  const resourceKey = recordKey(document, context.resourcesId)
  const pool = document.styles[resourceKey]
  if (pool?.kind !== 'text-context-resources' || pool.origin !== 'source') invalid('text pool')
  const inventory = (refs, kind) => refs.flatMap((ref) => {
    const value = at(document.textInventories, ref, 'text inventory')
    if (value.kind !== kind) invalid('text inventory kind')
    return value.records.map((id) => resourceValue(document, pool, id, kind === 'fontRequests' ? 'font' : 'provenance', budget))
  })
  context.theme = resourceValue(document, pool, shape.theme, 'theme', budget)
  context.fontRequests = inventory(shape.fontRequests, 'fontRequests')
  context.provenance = inventory(wire.provenance, 'provenance')
  for (const layers of contextLayerSets(context)) {
    layers.entries = scopeRecords(document, layers.scope).map((id) => resourceValue(document, pool, id, 'declaration', budget))
    delete layers.scope
  }
  context.schemaVersion = 1
  delete context.resourcesId
  if (bytes(context) > 8388608) invalid('context evaluation byte budget')
  return context
}
function semanticRecord(document, kind, id) {
  if (!document || id === undefined || id === null) return undefined
  if (document.schemaVersion !== 3) return document[kind]?.[id]
  const key = recordKey(document, id)
  if (key === undefined) return undefined
  const cacheKey = kind + ':' + key
  const isCertified = certifiedImmutableDocuments.has(document)
  let docMap = isCertified ? decodedRecords.get(document) : undefined
  if (docMap && docMap.has(cacheKey)) return docMap.get(cacheKey)
  const wire = document[kind]?.[key]
  if (!wire) return undefined
  const budget = evaluationBudget()
  const value = decodeValue(document, kind === 'styles' && wire.kind === 'text-context'
    ? { ...wire, payload: null } : wire, '', 0, budget)
  if (kind === 'styles' && wire.kind === 'text-context') value.payload = decodeContext(document, wire.payload, budget)
  if (kind === 'styles' && wire.kind === 'text-context-resources') {
    value.payload.records = Object.fromEntries(Object.entries(wire.payload.records).map(([k, record]) =>
      [k, { kind: record.kind, value: resourceValue(document, wire, k, record.kind, budget) }]))
  }
  const result = freeze(value)
  if (isCertified) {
    if (!docMap) {
      docMap = new Map()
      decodedRecords.set(document, docMap)
    }
    docMap.set(cacheKey, result)
  }
  return result
}
const semanticDefinition = (document, id) => semanticRecord(document, 'definitions', id)
const semanticInstance = (document, id) => semanticRecord(document, 'instances', id)
const semanticStyle = (document, id) => semanticRecord(document, 'styles', id)
function* semanticRecords(document, kind, filter = null) {
  if (!document || !document[kind]) return
  const predicate = typeof filter === 'function'
    ? filter
    : filter && typeof filter === 'object' && filter.kind
      ? (wire) => wire && wire.kind === filter.kind
      : null
  for (const key of Object.keys(document[kind])) {
    const wire = document[kind][key]
    if (predicate && !predicate(wire)) continue
    const id = document.schemaVersion === 3 && /^(0|[1-9]\d*)$/.test(key)
      ? semanticIdentity(document, Number(key)) : key
    yield [id, semanticRecord(document, kind, id)]
  }
}
const semanticDefinitions = (document, filter) => semanticRecords(document, 'definitions', filter)
const semanticInstances = (document, filter) => semanticRecords(document, 'instances', filter)
const semanticStyles = (document, filter) => semanticRecords(document, 'styles', filter)

function canonicalSemanticRevision(document) {
  if (!document) return ''
  let hashStr = String(document.schemaVersion)
  for (const kind of ['definitions', 'instances', 'styles', 'declarationScopes', 'sourceParts', 'sourceLocations', 'textShapes', 'textInventories', 'sourceIdentities', 'typedPropertyValues', 'sourceRelationships', 'fontDescriptors', 'partUris']) {
    if (document[kind]) hashStr += JSON.stringify(document[kind])
  }
  let h = 0x811c9dc5
  for (let i = 0; i < hashStr.length; i++) {
    h ^= hashStr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function encodeId(document, value) {
  if (value === null || value === undefined) return value
  if (Number.isSafeInteger(value)) return value
  const index = indexFor(document).get(value)
  return index !== undefined ? index : value
}

function encodeWireRecord(document, kind, record) {
  if (record === null || record === undefined) return record
  if (kind === 'instances') {
    const wire = { ...record }
    if (typeof wire.id === 'string') wire.id = encodeId(document, wire.id)
    if (typeof wire.definitionId === 'string') wire.definitionId = encodeId(document, wire.definitionId)
    if (typeof wire.parentInstanceId === 'string') wire.parentInstanceId = encodeId(document, wire.parentInstanceId)
    if (wire.sourceBinding && typeof wire.sourceBinding.contextId === 'string') {
      wire.sourceBinding = { ...wire.sourceBinding, contextId: encodeId(document, wire.sourceBinding.contextId) }
    }
    if (wire.textSourceBinding && typeof wire.textSourceBinding.contextId === 'string') {
      wire.textSourceBinding = { ...wire.textSourceBinding, contextId: encodeId(document, wire.textSourceBinding.contextId) }
    }
    return wire
  }
  return record
}

function replaceSemanticRecords(document, patch = {}) {
  if (!document) return document
  const isCertified = certifiedImmutableDocuments.has(document)
  if (document.schemaVersion !== 3) {
    let changed = false
    const next = { ...document }
    for (const kind of ['definitions', 'instances', 'styles']) {
      if (!patch[kind]) continue
      const dict = { ...(next[kind] || {}) }
      for (const [id, rec] of Object.entries(patch[kind])) {
        if (rec === null) {
          delete dict[id]
        } else {
          dict[id] = rec
        }
        changed = true
      }
      next[kind] = dict
    }
    if (!changed) return document
    if (isCertified) {
      freeze(next)
      certifiedImmutableDocuments.add(next)
      const prevDocMap = decodedRecords.get(document)
      if (prevDocMap) {
        const nextDocMap = new Map(prevDocMap)
        for (const kind of ['definitions', 'instances', 'styles']) {
          if (!patch[kind]) continue
          for (const id of Object.keys(patch[kind])) {
            nextDocMap.delete(`${kind}:${id}`)
          }
        }
        decodedRecords.set(next, nextDocMap)
      }
      if (decodedResources.has(document)) decodedResources.set(next, decodedResources.get(document))
      if (indices.has(document)) indices.set(next, indices.get(document))
    }
    return next
  }

  let changed = false
  const next = { ...document }
  for (const kind of ['definitions', 'instances', 'styles']) {
    if (!patch[kind]) continue
    const dict = { ...(next[kind] || {}) }
    for (const [id, rec] of Object.entries(patch[kind])) {
      const key = String(recordKey(document, id))
      if (rec === null) {
        delete dict[key]
      } else {
        dict[key] = encodeWireRecord(document, kind, rec)
      }
      changed = true
    }
    next[kind] = dict
  }
  if (!changed) return document
  if (isCertified) {
    freeze(next)
    certifiedImmutableDocuments.add(next)
    const prevDocMap = decodedRecords.get(document)
    if (prevDocMap) {
      const nextDocMap = new Map(prevDocMap)
      for (const kind of ['definitions', 'instances', 'styles']) {
        if (!patch[kind]) continue
        for (const id of Object.keys(patch[kind])) {
          const key = recordKey(document, id)
          nextDocMap.delete(`${kind}:${key}`)
        }
      }
      decodedRecords.set(next, nextDocMap)
    }
    if (decodedResources.has(document)) decodedResources.set(next, decodedResources.get(document))
    if (indices.has(document)) indices.set(next, indices.get(document))
  }
  return next
}

module.exports = {
  CATALOGS,
  semanticRecord,
  decodeValue,
  semanticRecords,
  semanticIdentity,
  semanticDefinition,
  semanticInstance,
  semanticStyle,
  semanticDefinitions,
  semanticInstances,
  semanticStyles,
  replaceSemanticRecords,
  validateGraphStructure,
  canonicalSemanticRevision,
  cloneImmutableSemanticDocument,
  certifyImmutableSemanticDocument,
  isCertifiedSemanticDocument,
}
