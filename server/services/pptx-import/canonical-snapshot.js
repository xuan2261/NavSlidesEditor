const INTERNAL_KEYS = new Set([
  'sourceRef', 'sourceMap', 'sourceMapRevisionId', 'packageRevisionId', 'journal',
  'journalRevisionId', 'pendingJournalHash', 'originalPath', 'packagePath',
  'pptxOriginal', 'pptxAggregateHead',
  'aggregateGeneration', 'idempotencyKey',
])
const DEFAULTS = Object.freeze({
  maxSlides: 500,
  maxElements: 20000,
  maxDepth: 16,
  maxObjectKeys: 100000,
  maxStringBytes: 8 * 1024 * 1024,
  maxSnapshotBytes: 50 * 1024 * 1024,
})

function budgetError(message) {
  const error = new RangeError(`Snapshot budget exceeded: ${message}`)
  error.code = 'SNAPSHOT_BUDGET_EXCEEDED'
  return error
}

function assertSnapshotBudget(snapshot, limits = {}) {
  const budget = { ...DEFAULTS, ...limits }
  let elements = 0
  let stringBytes = 0
  let objectKeys = 0
  const visit = (value, depth, key) => {
    if (depth > budget.maxDepth) throw budgetError('nesting')
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value)
      if (stringBytes > budget.maxStringBytes) throw budgetError('strings')
      return
    }
    if (!value || typeof value !== 'object') return
    objectKeys += Object.keys(value).length
    if (objectKeys > budget.maxObjectKeys) throw budgetError('passthrough properties')
    if (key === 'elements') {
      elements += Array.isArray(value) ? value.length : 0
      if (elements > budget.maxElements) throw budgetError('elements')
    }
    for (const [childKey, child] of Object.entries(value)) visit(child, depth + 1, childKey)
  }
  if (!Array.isArray(snapshot?.slides)) throw new TypeError('Editable snapshot requires slides')
  if (snapshot.slides.length > budget.maxSlides) throw budgetError('slides')
  visit(snapshot, 0, '')
  const encodedBytes = Buffer.byteLength(JSON.stringify(snapshot))
  if (encodedBytes > budget.maxSnapshotBytes) throw budgetError('aggregate bytes')
  return encodedBytes
}

function isInternal(key) {
  return /^_pptx/i.test(key) || INTERNAL_KEYS.has(key) ||
    /^(?:source|package|journal)(?:Authority|Path)$/.test(key)
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isInternal(key))
      .map(([key, child]) => [key, sanitize(child)])
  )
}

function canonicalEditableSnapshot(snapshot, limits) {
  assertSnapshotBudget(snapshot, limits)
  return sanitize(snapshot)
}

module.exports = { assertSnapshotBudget, canonicalEditableSnapshot }
