const { sourcePath } = require('./pptx-semantic-text-context-data')

const PROPERTY_FIELDS = new Set([
  'properties', 'fontLatin', 'fontEastAsian', 'fontComplexScript', 'borders',
  'paragraphProperties', 'runProperties', 'styleRefs', 'target', 'extent',
  'frameProperties', 'color', 'fill', 'stroke',
])

const ID_FIELDS = new Set([
  'id', 'componentId', 'definitionId', 'contextId', 'declarationIds',
  'transformDeclarationIds', 'occurrenceId', 'styleId', 'resourcesId',
  'anchorCellId', 'parentInstanceId', 'declarationId', 'masterDefinitionId',
  'layoutDefinitionId', 'paintComponentId', 'parentDefinitionId',
  'ownerDefinitionId', 'targetDefinitionId', 'targetInstanceId',
  'themeId', 'colorMapIds', 'bindingId',
])

function compactSemanticGraph(document) {
  if (!document || document.schemaVersion === 3) return document
  const candidate = JSON.parse(JSON.stringify(document))

  // 1. Scopes
  const contexts = Object.values(candidate.styles || {})
    .filter((v) => v.kind === 'text-context')
    .map((v) => v.payload)

  for (const p of contexts) {
    function* sets() {
      yield p.body
      for (const para of p.paragraphs || []) {
        yield para.paragraph
        yield para.run
        for (const r of para.runs || []) yield r.layers
      }
    }
    for (const s of sets()) {
      if (s?.entries) s.entries = s.entries.map((x) => p.declarations[x] ?? x)
    }
    delete p.declarations
  }

  const scopes = []
  const scopeIds = new Map()
  function scope(entries) {
    let parent = null
    for (let index = entries.length - 1; index >= 0; index--) {
      const key = JSON.stringify([entries[index], parent])
      if (!scopeIds.has(key)) {
        scopeIds.set(key, scopes.length)
        scopes.push({ declaration: entries[index], parent })
      }
      parent = scopeIds.get(key)
    }
    return parent
  }

  for (const p of contexts) {
    const ss = [p.body]
    for (const para of p.paragraphs || []) {
      ss.push(para.paragraph, para.run)
      for (const r of para.runs || []) ss.push(r.layers)
    }
    for (const s of ss) {
      if (s) {
        s.scope = scope(s.entries)
        delete s.entries
      }
    }
  }
  candidate.declarationScopes = scopes

  // 2. Parts & Locations
  const parts = []
  const partIds = new Map()
  function part(uri, h) {
    const key = `${uri}|${h}`
    if (!partIds.has(key)) {
      partIds.set(key, parts.length)
      parts.push({ partUri: uri, preconditionHash: h })
    }
    return partIds.get(key)
  }

  const sources = []
  const sourceIds = new Map()
  function loc(uri, h, path, extras = null) {
    const key = JSON.stringify([uri, h, path, extras])
    if (!sourceIds.has(key)) {
      sourceIds.set(key, sources.length)
      sources.push({ part: part(uri, h), path, ...(extras || {}) })
    }
    return { sourceId: sourceIds.get(key) }
  }

  const hashes = new Map()
  for (const v of Object.values(candidate.definitions || {})) {
    if (v.source?.partUri && v.source?.preconditionHash) {
      hashes.set(v.source.partUri, v.source.preconditionHash)
    }
  }

  function transformLocators(x, owner = null) {
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map((v) => transformLocators(v, owner))
    const keys = Object.keys(x)
    if (keys.length === 3 && 'partUri' in x && 'preconditionHash' in x && 'componentLocator' in x) {
      const l = x.componentLocator
      const { path, preconditionHash: _preconditionHash, ...extras } = l
      return loc(x.partUri, x.preconditionHash, path, extras)
    }
    if (keys.length === 2 && 'part' in x && 'path' in x && hashes.has(x.part)) {
      return { textSourceId: loc(x.part, hashes.get(x.part), sourcePath(x)).sourceId }
    }
    if (keys.length === 2 && 'path' in x && 'preconditionHash' in x && owner) {
      return { locatorId: loc(owner, x.preconditionHash, x.path).sourceId }
    }
    const own = (x.source && typeof x.source === 'object' && x.source.partUri) || owner
    const out = {}
    for (const [k, v] of Object.entries(x)) out[k] = transformLocators(v, own)
    return out
  }

  let transformed = transformLocators(candidate)
  transformed.sourceParts = parts
  transformed.sourceLocations = sources

  // 3. Shape graphs & inventories
  const shapegraphs = []
  const shapeids = new Map()
  for (const style of Object.values(transformed.styles || {})) {
    if (style.kind !== 'text-context') continue
    const p = style.payload
    const graph = {}
    for (const [k, v] of Object.entries(p)) {
      if (!['schemaVersion', 'occurrenceId', 'hostSlidePartUri', 'relationships'].includes(k)) {
        graph[k] = v
      }
    }
    const key = JSON.stringify(graph)
    if (!shapeids.has(key)) {
      shapeids.set(key, shapegraphs.length)
      shapegraphs.push(graph)
    }
    style.payload = {
      schemaVersion: p.schemaVersion,
      occurrenceId: p.occurrenceId,
      hostSlidePartUri: p.hostSlidePartUri,
      relationships: p.relationships,
      shape: shapeids.get(key),
    }
  }

  function ownpart(rid, resourcesId) {
    const pool = transformed.styles[resourcesId]?.payload?.records
    const locId = pool?.[rid]?.value?.source?.textSourceId
    return locId !== undefined ? sources[locId]?.part : undefined
  }

  const inventories = []
  const inventoryids = new Map()
  for (const graph of shapegraphs) {
    for (const kind of ['fontRequests', 'provenance']) {
      const groups = []
      for (const rid of graph[kind] || []) {
        const owner = ownpart(rid, graph.resourcesId)
        if (groups.length && groups[groups.length - 1][0] === owner) {
          groups[groups.length - 1][1].push(rid)
        } else {
          groups.push([owner, [rid]])
        }
      }
      const refs = []
      for (const [owner, ids] of groups) {
        const key = `${kind}|${owner}|${ids.join(',')}`
        if (!inventoryids.has(key)) {
          inventoryids.set(key, inventories.length)
          inventories.push({ kind, ...(owner !== undefined ? { ownerPart: owner } : {}), records: ids })
        }
        refs.push(inventoryids.get(key))
      }
      graph[kind] = refs
    }
  }
  transformed.textInventories = inventories

  const newshapes = []
  const newshapeids = new Map()
  for (const style of Object.values(transformed.styles || {})) {
    if (style.kind !== 'text-context') continue
    const p = style.payload
    const shape = shapegraphs[p.shape]
    p.provenance = shape.provenance
    const value = { ...shape }
    delete value.provenance
    const key = JSON.stringify(value)
    if (!newshapeids.has(key)) {
      newshapeids.set(key, newshapes.length)
      newshapes.push(value)
    }
    p.shape = newshapeids.get(key)
  }
  transformed.textShapes = newshapes

  // 4. Lexical property values
  const lex = []
  const lexids = new Map()
  function lexical(x) {
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(lexical)
    const result = {}
    for (const [k, v] of Object.entries(x)) {
      if (
        PROPERTY_FIELDS.has(k) &&
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        JSON.stringify(v).length > 15
      ) {
        const key = `${k}|${JSON.stringify(v)}`
        if (!lexids.has(key)) {
          lexids.set(key, lex.length)
          lex.push({ kind: k, value: v })
        }
        result[k] = { valueId: lexids.get(key) }
      } else {
        result[k] = lexical(v)
      }
    }
    return result
  }

  const lexcandidate = lexical(transformed)
  lexcandidate.typedPropertyValues = lex

  // 5. Source relationships
  const relationrecords = []
  const relationids = new Map()
  function relations(x) {
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(relations)
    const out = {}
    for (const [k, v] of Object.entries(x)) {
      if (['edges', 'relationships'].includes(k) && Array.isArray(v)) {
        out[k] = v.map((edge) => {
          const key = `${k}|${JSON.stringify(edge)}`
          if (!relationids.has(key)) {
            relationids.set(key, relationrecords.length)
            relationrecords.push({ kind: k, value: edge })
          }
          return relationids.get(key)
        })
      } else {
        out[k] = relations(v)
      }
    }
    return out
  }

  const relcandidate = relations(lexcandidate)
  relcandidate.sourceRelationships = relationrecords

  // 6. Part URIs
  const parts2 = []
  const partids2 = new Map()
  function partref(s) {
    if (!partids2.has(s)) {
      partids2.set(s, parts2.length)
      parts2.push(s)
    }
    return { partId: partids2.get(s) }
  }

  const partFields = new Set([
    'partUri', 'part', 'ownerPartUri', 'targetPartUri', 'fromPartUri', 'toPartUri',
    'hostSlidePartUri', 'relationshipChain',
  ])
  function partstrings(x, field = '') {
    if (typeof x === 'string' && partFields.has(field) && x.startsWith('ppt/') && !x.includes('#')) {
      return partref(x)
    }
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map((value) => partstrings(value, field))
    const out = {}
    for (const [k, v] of Object.entries(x)) {
      out[k] = k === 'sourceSlides' ? v : partstrings(v, k)
    }
    return out
  }

  const pc = partstrings(relcandidate)
  pc.partUris = parts2

  // 7. Identity catalog
  const identities = []
  const identityids = new Map()
  function identity(s) {
    if (!identityids.has(s)) {
      identityids.set(s, identities.length)
      identities.push(s)
    }
    return identityids.get(s)
  }


  function ids_transform(x, field = '') {
    if (ID_FIELDS.has(field) && typeof x === 'string') return identity(x)
    if (!x || typeof x !== 'object') return x
    if (Array.isArray(x)) {
      const itemField = ID_FIELDS.has(field) ? field : ''
      return x.map((value) => ids_transform(value, itemField))
    }
    const out = {}
    for (const [k, v] of Object.entries(x)) {
      const dictionary = ['definitions', 'instances', 'styles', 'components'].includes(field)
      const key = dictionary ? String(identity(k)) : k
      out[key] = ids_transform(v, k)
    }
    return out
  }

  const idCandidate = ids_transform(pc)

  // Structured compact sourceIdentities: [partId, role, id]
  const compact_ids = []
  for (const s of identities) {
    const m = typeof s === 'string' ? s.match(/^(ppt\/[^#]+)#([^:]+):(.+)$/) : null
    if (m && partids2.has(m[1])) {
      compact_ids.push([partids2.get(m[1]), m[2], m[3]])
    } else {
      const tc = typeof s === 'string' ? s.match(/^text-context:(ppt\/[^#]+)#([^:]+):(.+)$/) : null
      if (tc && partids2.has(tc[1])) {
        compact_ids.push([partids2.get(tc[1]), tc[2], tc[3], 'text-context'])
      } else {
        compact_ids.push(s)
      }
    }
  }

  // 8. Font descriptors and provenance in pool
  const font_descriptors = []
  const font_desc_map = new Map()
  for (const poolEntry of Object.values(idCandidate.styles || {}).filter(
    (value) => value.kind === 'text-context-resources'
  )) {
    const existingDescriptors = poolEntry.payload.fontDescriptors
    delete poolEntry.payload.fontDescriptors
    for (const rec of Object.values(poolEntry.payload.records)) {
      if (rec.kind === 'font' && rec.value.descriptorId !== undefined && existingDescriptors) {
        const desc = existingDescriptors[rec.value.descriptorId]
        delete rec.value.descriptorId
        Object.assign(rec.value, desc)
      }
    }
    const fpool_v2 = {}
    for (const [rid, rec] of Object.entries(poolEntry.payload.records)) {
      if (rec.kind === 'font') {
        const { source, id, ...desc } = rec.value
        const sortedDesc = Object.fromEntries(
          Object.keys(desc).sort().map((k) => [k, desc[k]])
        )
        const key = JSON.stringify(sortedDesc)
        if (!font_desc_map.has(key)) {
          font_desc_map.set(key, font_descriptors.length)
          font_descriptors.push(sortedDesc)
        }
        fpool_v2[rid] = {
          kind: 'font',
          value: {
            ...(id === undefined ? {} : { id }),
            source,
            descriptorId: font_desc_map.get(key),
          },
        }
      } else if (rec.kind === 'provenance') {
        fpool_v2[rid] = {
          kind: 'provenance',
          value: Object.fromEntries(Object.entries(rec.value).filter(([key, value]) => {
            if (key !== 'preconditionHash') return true
            const location = idCandidate.sourceLocations[rec.value.source?.textSourceId]
            return idCandidate.sourceParts[location?.part]?.preconditionHash !== value
          })),
        }
      } else {
        fpool_v2[rid] = rec
      }
    }
    poolEntry.payload.records = fpool_v2
  }

  idCandidate.schemaVersion = 3
  idCandidate.sourceIdentities = compact_ids
  idCandidate.fontDescriptors = font_descriptors
  idCandidate.partUris = parts2

  function resourceIndex(id) {
    if (typeof id !== 'string' || !/^record-(0|[1-9]\d*)$/.test(id))
      throw new TypeError('Invalid semantic graph resource identity')
    const index = Number(id.slice(7))
    if (!Number.isSafeInteger(index) || index < 0)
      throw new TypeError('Invalid semantic graph resource identity')
    return index
  }
  for (const scope of idCandidate.declarationScopes)
    scope.declaration = resourceIndex(scope.declaration)
  for (const inventory of idCandidate.textInventories)
    inventory.records = inventory.records.map(resourceIndex)
  for (const shape of idCandidate.textShapes)
    shape.theme = resourceIndex(shape.theme)

  return idCandidate
}

module.exports = { compactSemanticGraph }
