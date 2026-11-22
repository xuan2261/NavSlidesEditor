const { jsonStringByteLength, primitiveCloneMetrics } = require('./pptx-semantic-clone-metrics.js')
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
// Representation-only wire membership, never a validation/admission receipt.
// Dictionary ownership includes its records; freezing/certification alone is not proof.
const wireMembershipIndices = new WeakMap()
function wireMembershipIndex(dictionary) {
  if (!isCheckedImmutableSemanticValue(dictionary)) return null
  let index = wireMembershipIndices.get(dictionary)
  if (!index) {
    index = { keys: Object.freeze(Object.keys(dictionary)), kinds: null }
    wireMembershipIndices.set(dictionary, index)
  }
  return index
}
function wireKindKeys(dictionary, index, kind) {
  if (!index.kinds) {
    const kinds = new Map()
    for (const key of index.keys) {
      const wire = dictionary[key]
      if (!wire) continue
      const bucket = kinds.get(wire.kind)
      if (bucket) bucket.push(key)
      else kinds.set(wire.kind, [key])
    }
    for (const bucket of kinds.values()) Object.freeze(bucket)
    index.kinds = kinds
  }
  return index.kinds.get(kind) || EMPTY_WIRE_KEYS
}
const EMPTY_WIRE_KEYS = Object.freeze([])
const decodedRecords = new WeakMap()
const decodedResources = new WeakMap()
const certifiedImmutableDocuments = new WeakSet()
// Decode receipts are representation-only, never semantic admission. Require
// an immutable root and the complete checked catalog tuple: certification alone
// cannot prove catalog ownership. Root identity fixes all dependencies (including
// styles/resource pools); a replacement catalog therefore gets a fresh cache.
const decodeCacheRoots = new WeakSet()
function canCacheDecode(document) {
  if (decodeCacheRoots.has(document)) return true
  if (!(isCheckedImmutableSemanticValue(document) || certifiedImmutableDocuments.has(document)) ||
      !CATALOGS.every((field) => isCheckedImmutableSemanticValue(document[field]))) return false
  decodeCacheRoots.add(document)
  return true
}
// Producer provenance, not validation authority. No public setter exists.
const semanticPredecessors = new WeakMap()
function semanticRecordPredecessor(document) {
  if (!isCertifiedSemanticDocument(document)) return undefined
  const provenance = semanticPredecessors.get(document)
  const previous = provenance?.previous.deref()
  // A missing/collected predecessor disables incremental indexing. Only this
  // detached, frozen read result owns the resolved root, never stored lineage.
  return previous ? Object.freeze({ previous, instanceIds: provenance.instanceIds }) : undefined
}
function rememberPredecessor(next, previous, changedInstanceIds) {
  // Never replace weak lineage with a strong history chain on older runtimes.
  if (typeof WeakRef !== 'function') return
  const instanceIds = changedInstanceIds.map((id) => {
    const key = previous.schemaVersion === 3 ? String(recordKey(previous, id)) : id
    return previous.schemaVersion === 3 && /^(0|[1-9]\d*)$/.test(key)
      ? semanticIdentity(previous, Number(key)) : key
  })
  semanticPredecessors.set(next, Object.freeze({ previous: new WeakRef(previous), instanceIds: Object.freeze(instanceIds) }))
}
// Only roots allocated and recursively frozen by the checked clone qualify.
// This proof grants no successful-normalization status or decode success receipt.
const immutableCloneRoots = new WeakSet()
// Read-only handoff: only a fully successful checked allocation publishes metrics.
const cloneMetrics = new WeakMap()
function checkedCloneBudgetMetrics(value) {
  return isCheckedImmutableSemanticValue(value) ? cloneMetrics.get(value) : undefined
}
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

// Transfer representation caches only: no certification or admission receipts.
function transferPredecessorDecodeCaches(document, previous) {
  if (document === previous || !isCheckedImmutableSemanticValue(previous) ||
      document.schemaVersion !== previous.schemaVersion ||
      document.styles !== previous.styles ||
      !CATALOGS.every((field) => document[field] === previous[field])) return
  const records = decodedRecords.get(previous)
  if (records) {
    const retained = new Map()
    for (const [cacheKey, value] of records) {
      const separator = cacheKey.indexOf(':')
      const kind = cacheKey.slice(0, separator)
      const key = cacheKey.slice(separator + 1)
      if (Object.prototype.hasOwnProperty.call(document[kind] || {}, key) &&
          document[kind][key] === previous[kind]?.[key]) retained.set(cacheKey, value)
    }
    decodedRecords.set(document, retained)
  }
  if (decodedResources.has(previous)) decodedResources.set(document, decodedResources.get(previous))
  if (indices.has(previous)) indices.set(document, indices.get(previous))
}

function cloneImmutableSemanticDocument(input, limits, ErrorType = TypeError, predecessor) {
  function fail(message) { throw new ErrorType(message) }
  let nodes = 0
  const ancestors = new Set()
  const stagedMetrics = new WeakMap()
  const completed = []
  function clone(value, depth = 0, candidate) {
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
    const array = Array.isArray(value)
    // Candidates are exclusively checked-owned allocations. Still inspect every
    // raw descriptor and recurse before deciding equivalence (including key order).
    if (!isCheckedImmutableSemanticValue(candidate) || Array.isArray(candidate) !== array) candidate = undefined
    const keys = Reflect.ownKeys(value).filter((key) => !(array && key === 'length'))
    const candidateKeys = candidate ? Object.keys(candidate) : []
    let equal = !!candidate && keys.length === candidateKeys.length &&
      keys.every((key, index) => key === candidateKeys[index])
    let result = equal ? undefined : array ? [] : {}
    const metrics = { nodeCount: 1, maxRelativeDepth: 0,
      maxArrayLength: array ? value.length : 0, jsonBytes: 2 }
    let measured = true
    let entries = 0
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue
      if (typeof key !== 'string' || AUTHORITY_KEYS.has(key))
        fail('Forbidden semantic authority key')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        fail('Semantic content must use enumerable data property')
      }
      if (Array.isArray(value)) {
        const index = Number(key)
        if (!Number.isInteger(index) || index < 0 || index >= value.length || String(index) !== key) {
          fail('Invalid semantic array key')
        }
      }
      const child = clone(descriptor.value, depth + 1, candidate?.[key])
      if (equal && !Object.is(child, candidate[key])) {
        equal = false
        result = array ? [] : {}
        for (let index = 0; index < entries; index++) result[keys[index]] = candidate[keys[index]]
      }
      if (result) result[key] = child
      const childMetrics = child !== null && typeof child === 'object'
        ? stagedMetrics.get(child) || checkedCloneBudgetMetrics(child)
        : primitiveCloneMetrics(child)
      // An owned survivor of an earlier failed allocation has no receipt yet.
      // Keep ownership, but let the budget helper measure it via its fallback.
      if (!childMetrics) measured = false
      else {
        metrics.nodeCount += childMetrics.nodeCount
        metrics.maxRelativeDepth = Math.max(metrics.maxRelativeDepth, 1 + childMetrics.maxRelativeDepth)
        metrics.maxArrayLength = Math.max(metrics.maxArrayLength, childMetrics.maxArrayLength)
        metrics.jsonBytes += childMetrics.jsonBytes + (array ? 0 : jsonStringByteLength(key) + 1)
      }
      if (entries++) metrics.jsonBytes++
    }
    ancestors.delete(value)
    if (equal) return candidate
    const frozen = Object.freeze(result)
    immutableCloneRoots.add(frozen)
    if (measured) {
      stagedMetrics.set(frozen, Object.freeze(metrics))
      completed.push(frozen)
    }
    return frozen
  }
  const document = clone(input, 0, isCheckedImmutableSemanticValue(predecessor) ? predecessor : undefined)
  for (const value of completed) cloneMetrics.set(value, stagedMetrics.get(value))
  if (document && typeof document === 'object') {
    immutableCloneRoots.add(document)
    if (decodedRecords.has(input)) decodedRecords.set(document, decodedRecords.get(input))
    if (decodedResources.has(input)) decodedResources.set(document, decodedResources.get(input))
    if (indices.has(input)) indices.set(document, indices.get(input))
    // The checked clone preserves all enumerable JSON values exactly. Transfer
    // IDs only, never caller patch record references or validation authority.
    if (semanticPredecessors.has(input)) semanticPredecessors.set(document, semanticPredecessors.get(input))
  }
  if (document && typeof document === 'object') transferPredecessorDecodeCaches(document, predecessor)
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
  return document
}

function isCheckedImmutableSemanticValue(value) {
  return value !== null && typeof value === 'object' && immutableCloneRoots.has(value)
}

function isCertifiedSemanticDocument(document) {
  return document !== null && typeof document === 'object' && certifiedImmutableDocuments.has(document)
}
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const textEncoder = new TextEncoder()
const bytes = (value) => {
  if (typeof value === 'string') return jsonStringByteLength(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value).length
  if (value === true) return 4
  if (value === false) return 5
  if (value === null) return 4
  // Keep actual JSON dispatch for containers and unsupported primitives.
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
// Structural success is separate from whole-document semantic admission. The
// validator reads schemaVersion and these catalogs only (including the three
// source/scope catalogs). Its scope-depth cap is a fixed 256, not a caller limit.
// A weak identity trie retains no raw document or replaceable catalog roots.
const graphStructureReceipts = new WeakMap()
function graphReceiptSlot(document) {
  const roots = CATALOGS.map((field) => document[field])
  if (!roots.every(isCheckedImmutableSemanticValue)) return null
  let slots = graphStructureReceipts
  for (const root of roots) {
    let next = slots.get(root)
    if (!next) slots.set(root, next = new WeakMap())
    slots = next
  }
  // schemaVersion is exactly 3 here; use the final checked root as the leaf key.
  return { slots, key: roots[roots.length - 1] }
}
function validateGraphStructure(document) {
  if (!document || document.schemaVersion !== 3) return
  const receipt = graphReceiptSlot(document)
  if (receipt?.slots.has(receipt.key)) return
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
  // Neither clone ownership nor certification alone grants this receipt.
  if (receipt) receipt.slots.set(receipt.key, true)
}
// A raw Object.freeze is only shallow. Keep this transitive proof private and
// separate from checked-clone ownership (and successful validation receipts).
const deeplyFrozenValues = new WeakSet()
const decoderAllocations = new WeakSet()
const ownedDecodedValues = new WeakSet()
function decoderAllocated(value) {
  decoderAllocations.add(value)
  return value
}
function freezeDecoded(value) {
  return freeze(value, new Set(), true)
}
function isOwnedDecodedSemanticValue(value) {
  return value !== null && typeof value === 'object' && ownedDecodedValues.has(value)
}
function freeze(value, ancestors = new Set(), decoded = false) {
  if (!value || typeof value !== 'object') return value
  // Frozen/checked membership never upgrades a raw value to decoder ownership;
  // previously proved decoder descendants already retain their private receipt.
  if (immutableCloneRoots.has(value) || deeplyFrozenValues.has(value)) return value
  if (ancestors.has(value)) invalid('Semantic content cycle')
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== null && prototype !== Object.prototype && prototype !== Array.prototype) {
    invalid('Semantic content must be a plain data record')
  }
  ancestors.add(value)
  // Freeze first so proxy descriptor invariants apply, and inspect descriptors
  // rather than reading properties: getter results are not owned data.
  Object.freeze(value)
  // Producer ownership is proved bottom-up during this same traversal, never
  // by generic patch freezing or by checked-clone/validation authority. A raw
  // passthrough child blocks its ancestors, but not independent owned siblings.
  let owned = decoded && decoderAllocations.has(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor)) {
      invalid('Semantic content must use data properties')
    }
    const child = descriptor.value
    freeze(child, ancestors, decoded)
    if (child !== null && typeof child === 'object' && !ownedDecodedValues.has(child)) owned = false
  }
  ancestors.delete(value)
  deeplyFrozenValues.add(value)
  if (owned) ownedDecodedValues.add(value)
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
function decodeValue(document, value, field = '', depth = 0, budget = evaluationBudget(), inGuide = false, materialize = true, decodeChild = null) {
  budget.visit(depth)
  if (Array.isArray(value)) {
    budget.charge(2 + Math.max(0, value.length - 1))
    if (field === 'edges' || field === 'relationships') {
      const decodeReference = (ref) => {
        if (typeof ref === 'object' && ref !== null) return decodeValue(document, ref, field, depth + 1, budget, inGuide, materialize)
        const relation = at(document.sourceRelationships, ref, 'relationship')
        if (relation.kind !== field) invalid('relationship kind')
        return decodeValue(document, relation.value, field, depth + 1, budget, inGuide, materialize)
      }
      if (materialize) return decoderAllocated(value.map(decodeReference))
      value.forEach(decodeReference)
      return
    }
    const decodeElement = (child) => decodeValue(document, child, field, depth + 1, budget, inGuide, materialize)
    if (materialize) return decoderAllocated(value.map(decodeElement))
    value.forEach(decodeElement)
    return
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
      return decodeValue(document, property.value, field, depth + 1, budget, inGuide, materialize)
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
      return decodeValue(document, result, '', depth + 1, budget, inGuide, materialize)
    }
    const result = materialize ? decoderAllocated({}) : undefined
    budget.charge(2 + Math.max(0, keys.length - 1))
    for (const [key, child] of Object.entries(value)) {
      const decodedKey = dictionaryKinds.has(field) && /^(0|[1-9]\d*)$/.test(key)
        ? semanticIdentity(document, Number(key)) : key
      if (decodedKey === undefined) invalid('dictionary identity')
      budget.charge(bytes(decodedKey) + 1)
      const guide = inGuide || key === 'sourceGuideList' || key === 'guides'
      const decoded = decodeChild
        ? decodeChild(child, key, depth + 1, budget, guide)
        : decodeValue(document, child, key, depth + 1, budget, guide, materialize)
      if (materialize) Object.defineProperty(result, decodedKey, { value: decoded, enumerable: true, writable: true, configurable: true })
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
  const cacheable = canCacheDecode(document)
  let pools = cacheable ? decodedResources.get(document) : undefined
  let resources = pools?.get(pool)
  const cached = resources?.get(id)
  if (cached) {
    budget.replay(cached.cost)
    return cached.value
  }
  const before = cacheable ? budget.snapshot() : null
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
  if (cacheable) {
    const after = budget.snapshot()
    if (!pools) {
      pools = new WeakMap()
      decodedResources.set(document, pools)
    }
    if (!resources) {
      resources = new Map()
      pools.set(pool, resources)
    }
    resources.set(id, { value: freezeDecoded(value), cost: {
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
  const inventory = (refs, kind) => decoderAllocated(refs.flatMap((ref) => {
    const value = at(document.textInventories, ref, 'text inventory')
    if (value.kind !== kind) invalid('text inventory kind')
    return value.records.map((id) => resourceValue(document, pool, id, kind === 'fontRequests' ? 'font' : 'provenance', budget))
  }))
  context.theme = resourceValue(document, pool, shape.theme, 'theme', budget)
  context.fontRequests = inventory(shape.fontRequests, 'fontRequests')
  context.provenance = inventory(wire.provenance, 'provenance')
  for (const layers of contextLayerSets(context)) {
    layers.entries = decoderAllocated(scopeRecords(document, layers.scope).map((id) => resourceValue(document, pool, id, 'declaration', budget)))
    delete layers.scope
  }
  context.schemaVersion = 1
  delete context.resourcesId
  if (bytes(context) > 8388608) invalid('context evaluation byte budget')
  return context
}
// The typed pool has two distinct obligations: generic wire admission (including
// unused fields), then resource expansion. Keep the former's exact depth/byte/
// visit charges, but do not allocate its discarded records tree. Other payload
// fields still use the generic decoder; this is not a schema-admission shortcut.
function decodeResourcePool(document, wire, budget) {
  const decodeRecords = (child, key, depth, budget, guide) =>
    decodeValue(document, child, key, depth, budget, guide, key !== 'records')
  const decodePayload = (child, key, depth, budget, guide) =>
    decodeValue(document, child, key, depth, budget, guide, true, key === 'payload' ? decodeRecords : null)
  return decodeValue(document, wire, '', 0, budget, false, true, decodePayload)
}
function semanticRecord(document, kind, id) {
  if (!document || id === undefined || id === null) return undefined
  if (document.schemaVersion !== 3) return document[kind]?.[id]
  const key = recordKey(document, id)
  if (key === undefined) return undefined
  const cacheKey = kind + ':' + key
  const cacheable = canCacheDecode(document)
  let docMap = cacheable ? decodedRecords.get(document) : undefined
  if (docMap && docMap.has(cacheKey)) return docMap.get(cacheKey)
  const wire = document[kind]?.[key]
  if (!wire) return undefined
  const budget = evaluationBudget()
  const value = kind === 'styles' && wire.kind === 'text-context-resources'
    ? decodeResourcePool(document, wire, budget)
    : decodeValue(document, kind === 'styles' && wire.kind === 'text-context'
      ? { ...wire, payload: null } : wire, '', 0, budget)
  if (kind === 'styles' && wire.kind === 'text-context') value.payload = decodeContext(document, wire.payload, budget)
  if (kind === 'styles' && wire.kind === 'text-context-resources') {
    value.payload.records = decoderAllocated(Object.fromEntries(Object.entries(wire.payload.records).map(([k, record]) =>
      [k, decoderAllocated({ kind: record.kind, value: resourceValue(document, wire, k, record.kind, budget) })])))
  }
  const result = freezeDecoded(value)
  if (cacheable) {
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
  const dictionary = document[kind]
  const index = wireMembershipIndex(dictionary)
  // Function predicates retain the full scan, invocation count and order. Only
  // a data-valued object kind selector can use wire membership. Accessors keep
  // the original predicate path and are never treated as identity proof.
  const selector = index && filter && typeof filter === 'object'
    ? Object.getOwnPropertyDescriptor(filter, 'kind') : null
  const selectedKind = selector && typeof selector.value === 'string' && selector.value
  const keys = index
    ? selectedKind ? wireKindKeys(dictionary, index, selectedKind) : index.keys
    : Object.keys(dictionary)
  for (const key of keys) {
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
  const changedInstanceIds = []
  const stylesChanged = patch.styles && Object.keys(patch.styles).length > 0
  const isCertified = certifiedImmutableDocuments.has(document)
  if (document.schemaVersion !== 3) {
    let changed = false
    const next = { ...document }
    for (const kind of ['definitions', 'instances', 'styles']) {
      if (!patch[kind]) continue
      const dict = { ...(next[kind] || {}) }
      for (const [id, rec] of Object.entries(patch[kind])) {
        if (kind === 'instances') changedInstanceIds.push(id)
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
      rememberPredecessor(next, document, changedInstanceIds)
      const prevDocMap = decodedRecords.get(document)
      if (prevDocMap && !stylesChanged) {
        const nextDocMap = new Map(prevDocMap)
        for (const kind of ['definitions', 'instances', 'styles']) {
          if (!patch[kind]) continue
          for (const id of Object.keys(patch[kind])) {
            nextDocMap.delete(`${kind}:${id}`)
          }
        }
        decodedRecords.set(next, nextDocMap)
      }
      if (!stylesChanged && decodedResources.has(document)) decodedResources.set(next, decodedResources.get(document))
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
      if (kind === 'instances') changedInstanceIds.push(id)
      const key = String(recordKey(document, id))
      if (rec === null) {
        delete dict[key]
      } else {
        // Check/freeze caller-retained data before encoding can read it.
        dict[key] = encodeWireRecord(document, kind, isCertified ? freeze(rec) : rec)
      }
      changed = true
    }
    next[kind] = dict
  }
  if (!changed) return document
  if (isCertified) {
    freeze(next)
    certifiedImmutableDocuments.add(next)
    rememberPredecessor(next, document, changedInstanceIds)
    // Styles can supply resources to any decoded context. Drop the whole decode
    // cache on style edits; catalog indexes remain valid and instance-only edits
    // still reuse unaffected records and resource expansions.
    const prevDocMap = decodedRecords.get(document)
    if (prevDocMap && !stylesChanged) {
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
    if (!stylesChanged && decodedResources.has(document)) decodedResources.set(next, decodedResources.get(document))
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
  semanticRecordPredecessor,
  validateGraphStructure,
  canonicalSemanticRevision,
  cloneImmutableSemanticDocument,
  checkedCloneBudgetMetrics,
  certifyImmutableSemanticDocument,
  isCertifiedSemanticDocument,
  isCheckedImmutableSemanticValue,
  isOwnedDecodedSemanticValue,
}
