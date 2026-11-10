const { fields, fail } = require('./pptx-semantic-text-context-data')

const CONTEXT_FIELDS = [
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
]

// Only repeated declaration records are interned. Targets, ordering, scope,
// source receipts and explicit false/zero remain unchanged.
function compactTextContext(context, options) {
  const expanded = expandTextContext(context, options)
  const declarations = {},
    ids = new Map()
  const layers = (set) => ({
    ...set,
    entries: set.entries.map((entry) => {
      const key = JSON.stringify(entry)
      if (!ids.has(key)) {
        const id = `layer-${ids.size}`
        ids.set(key, id)
        declarations[id] = entry
      }
      return ids.get(key)
    }),
  })
  return {
    ...expanded,
    schemaVersion: 2,
    declarations,
    body: layers(expanded.body),
    paragraphs: expanded.paragraphs.map((paragraph) => ({
      ...paragraph,
      paragraph: layers(paragraph.paragraph),
      run: layers(paragraph.run),
      runs: paragraph.runs.map((run) => ({ ...run, layers: layers(run.layers) })),
    })),
  }
}

function compactTextContexts(contexts, resourcesId) {
  const records = {},
    ids = new Map(),
    fontDescriptors = []
  const intern = (kind, value) => {
    const key = JSON.stringify([kind, value])
    if (!ids.has(key)) {
      const id = `record-${ids.size}`
      ids.set(key, id)
      records[id] = { kind, value }
    }
    return ids.get(key)
  }
  return {
    contexts: contexts.map((context) => {
      const compact = compactTextContext(context)
      return {
        ...compact,
        schemaVersion: 3,
        resourcesId,
        theme: intern('theme', compact.theme),
        provenance: compact.provenance.map((value) => intern('provenance', value)),
        fontRequests: compact.fontRequests.map((value) => intern('font', value)),
        declarations: Object.fromEntries(
          Object.entries(compact.declarations).map(([id, value]) => [
            id,
            intern('declaration', value),
          ])
        ),
      }
    }),
    records,
    fontDescriptors,
  }
}

function expandTextContext(
  context,
  { maxBytes = 8 * 1024 * 1024, consumeByteDelta, styles, resourceUsage } = {}
) {
  if (context.schemaVersion === 1) return context
  const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength
  if (context.schemaVersion === 3) {
    fields(context, [...CONTEXT_FIELDS, 'declarations', 'resourcesId'])
    if (typeof context.resourcesId !== 'string' || !context.resourcesId.length)
      fail('shared resource identity')
    const pool = styles?.[context.resourcesId]
    if (pool?.kind !== 'text-context-resources' || pool.origin !== 'source')
      fail('shared resource pool')
    fields(pool.payload, ['schemaVersion', 'records', 'fontDescriptors'], ['schemaVersion', 'records'])
    const records = pool.payload.records
    const fontDescriptors = pool.payload.fontDescriptors
    if (
      pool.payload.schemaVersion !== 1 ||
      !records ||
      typeof records !== 'object' ||
      Array.isArray(records) ||
      (fontDescriptors !== undefined && !Array.isArray(fontDescriptors)) ||
      !context.declarations ||
      typeof context.declarations !== 'object' ||
      Array.isArray(context.declarations) ||
      !Array.isArray(context.provenance) ||
      !Array.isArray(context.fontRequests)
    )
      fail('shared reference inventory')
    const record = { ...context }
    delete record.resourcesId
    let expandedBytes = bytes(record)
    const sizes = new Map()
    const read = (id, kind) => {
      if (
        typeof id !== 'string' ||
        !/^record-(0|[1-9]\d*)$/.test(id) ||
        !Object.hasOwn(records, id)
      )
        fail('shared resource reference')
      const resource = records[id]
      fields(resource, ['kind', 'value'])
      if (
        resource.kind !== kind ||
        !resource.value ||
        typeof resource.value !== 'object' ||
        Array.isArray(resource.value)
      )
        fail('shared resource kind')
      let resolvedValue = resource.value
      if (kind === 'font' && resolvedValue.descriptorId !== undefined) {
        const desc = fontDescriptors?.[resolvedValue.descriptorId]
        if (!desc) fail('font descriptor reference')
        resolvedValue = { source: resolvedValue.source, ...desc }
      }
      if (kind === 'provenance' && resolvedValue.preconditionHash === undefined) {
        const partUri = resolvedValue.source?.part
        const partHash = styles?.[partUri]?.payload?.preconditionHash
        if (partHash) resolvedValue = { ...resolvedValue, preconditionHash: partHash }
      }
      if (!sizes.has(id)) sizes.set(id, bytes(resolvedValue) - bytes(id))
      expandedBytes += sizes.get(id)
      if (expandedBytes > maxBytes) fail('expanded context byte budget')
      if (resourceUsage) {
        if (!resourceUsage.has(context.resourcesId))
          resourceUsage.set(context.resourcesId, new Set())
        resourceUsage.get(context.resourcesId).add(id)
      }
      return resolvedValue
    }
    const expanded = expandTextContext(
      {
        ...record,
        schemaVersion: 2,
        theme: read(context.theme, 'theme'),
        provenance: context.provenance.map((id) => read(id, 'provenance')),
        fontRequests: context.fontRequests.map((id) => read(id, 'font')),
        declarations: Object.fromEntries(
          Object.entries(context.declarations).map(([id, value]) => [
            id,
            read(value, 'declaration'),
          ])
        ),
      },
      { maxBytes }
    )
    consumeByteDelta?.(bytes(expanded) - bytes(context))
    return expanded
  }

  if (context.schemaVersion !== 2) fail('context identity/version')
  fields(context, [...CONTEXT_FIELDS, 'declarations'])
  const declarations = context.declarations
  if (!declarations || typeof declarations !== 'object' || Array.isArray(declarations))
    fail('declaration dictionary')
  const { declarations: omitted, ...record } = context
  let expandedBytes = bytes(record)
  const sizes = new Map()
  const used = new Set()
  const layers = (set) => {
    fields(set, ['target', 'entries'])
    if (!Array.isArray(set.entries)) fail('declaration references')
    return {
      target: set.target,
      entries: set.entries.map((id) => {
        if (
          typeof id !== 'string' ||
          !/^layer-(0|[1-9]\d*)$/.test(id) ||
          !Object.hasOwn(declarations, id)
        )
          fail('declaration reference')
        if (!sizes.has(id)) sizes.set(id, bytes(declarations[id]) - bytes(id))
        expandedBytes += sizes.get(id)
        if (expandedBytes > maxBytes) fail('expanded context byte budget')
        used.add(id)
        return declarations[id]
      }),
    }
  }
  if (!Array.isArray(context.paragraphs)) fail('paragraph inventory')
  const result = {
    ...record,
    schemaVersion: 1,
    body: layers(context.body),
    paragraphs: context.paragraphs.map((paragraph) => {
      fields(paragraph, ['source', 'paragraph', 'run', 'runs'])
      if (!Array.isArray(paragraph.runs)) fail('run inventory')
      return {
        ...paragraph,
        paragraph: layers(paragraph.paragraph),
        run: layers(paragraph.run),
        runs: paragraph.runs.map((run) => {
          fields(run, ['source', 'layers'])
          return { ...run, layers: layers(run.layers) }
        }),
      }
    }),
  }
  if (used.size !== Object.keys(omitted).length) fail('unused declaration')
  if (expandedBytes > maxBytes) fail('expanded context byte budget')
  consumeByteDelta?.(expandedBytes - bytes(context))
  return result
}

module.exports = { compactTextContext, compactTextContexts, expandTextContext }
