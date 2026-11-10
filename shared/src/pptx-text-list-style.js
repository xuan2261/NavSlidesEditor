const { cloneTextData, normalizeTextProperties } = require('./pptx-text-document')

// Declarations only: no kind, placeholder matching, inheritance or resolved data.
function normalizeTextListStyle(input) {
  const value = cloneTextData(input), ids = new Set(), levels = new Set()
  const fail = () => { throw new TypeError('Invalid PPTX text list style contract') }
  const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const keys = (v, allowed, required = []) => object(v) &&
    required.every((k) => Object.hasOwn(v, k)) && Object.keys(v).every((k) => allowed.includes(k))
  const id = (v) => {
    if (typeof v !== 'string' || !v.length || v.length > 256 || ids.has(v)) fail()
    ids.add(v)
  }
  if (!keys(value, ['schemaVersion', 'componentId', 'entries'], ['schemaVersion', 'componentId', 'entries']) ||
      value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.length > 10) fail()
  id(value.componentId)
  for (const entry of value.entries) {
    if (!keys(entry, ['componentId', 'source', 'level', 'properties', 'defaultRunProperties'],
      ['componentId', 'source', 'properties'])) fail()
    id(entry.componentId)
    const hasLevel = Object.hasOwn(entry, 'level'), level = hasLevel ? entry.level : 'default'
    if ((hasLevel && (!Number.isSafeInteger(level) || level < 0 || level > 8)) || levels.has(level)) fail()
    levels.add(level)
    if (!keys(entry.source, ['part', 'path'], ['part', 'path']) ||
        typeof entry.source.part !== 'string' || !entry.source.part.length || entry.source.part.length > 1024 ||
        typeof entry.source.path !== 'string' || !/^(0|[1-9]\d*)(\.(0|[1-9]\d*))*$/.test(entry.source.path) ||
        entry.source.path.length > 1024) fail()
    entry.properties = normalizeTextProperties(entry.properties, 'paragraph')
    if (Object.hasOwn(entry, 'defaultRunProperties'))
      entry.defaultRunProperties = normalizeTextProperties(entry.defaultRunProperties, 'run')
  }
  return value
}

module.exports = { normalizeTextListStyle }
