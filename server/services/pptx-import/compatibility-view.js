function currentGeneration(presentation) {
  const generation = presentation?.pptxAggregateHead?.generation
  return Number.isSafeInteger(generation) ? generation : null
}

function isStaleWrite(presentation, write) {
  const incomingGeneration = write?.generation
  const existingGeneration = currentGeneration(presentation)
  return Number.isSafeInteger(incomingGeneration) && existingGeneration !== null &&
    incomingGeneration < existingGeneration
}

const NESTED_SERVER_METADATA_KEYS = new Set([
  '_pptxMeta',
  '_pptxImportMeta',
  '_pptxChartMeta',
])
const SERVER_OWNED_METADATA_KEYS = Object.freeze([
  'createdAt',
  'updatedAt',
  'deletedAt',
  'pptxOriginal',
  'pptxSourceAvailable',
  '_pptxMeta',
  '_pptxImportMeta',
  '_pptxChartMeta',
  // Presentation-owned import diagnostics; never overwritten by client/canonical projection.
  '_pptxImportReport',
])

function sameNodeIdentity(existing, incoming) {
  if (!existing || !incoming || existing.id === undefined || incoming.id === undefined) {
    return false
  }
  return existing.id === incoming.id &&
    (!existing.type || !incoming.type || existing.type === incoming.type)
}

function mergeTrustedNestedMetadata(existing, incoming) {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    const byId = new Map(existing
      .filter((item) => item && typeof item === 'object' && item.id !== undefined)
      .map((item) => [item.id, item]))
    return incoming.map((item) => {
      if (!item || typeof item !== 'object' || item.id === undefined) return item
      const prior = byId.get(item.id)
      return prior ? mergeTrustedNestedMetadata(prior, item) : item
    })
  }
  if (!existing || typeof existing !== 'object' ||
      !incoming || typeof incoming !== 'object' ||
      !sameNodeIdentity(existing, incoming)) {
    return incoming
  }

  const next = structuredClone(incoming)
  for (const key of Object.keys(next)) {
    if (/^_pptx/i.test(key) && !NESTED_SERVER_METADATA_KEYS.has(key)) delete next[key]
  }
  for (const [key, value] of Object.entries(existing)) {
    if (NESTED_SERVER_METADATA_KEYS.has(key)) next[key] = structuredClone(value)
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (NESTED_SERVER_METADATA_KEYS.has(key)) continue
    if (value && typeof value === 'object' &&
        Object.prototype.hasOwnProperty.call(existing, key)) {
      next[key] = mergeTrustedNestedMetadata(existing[key], value)
    }
  }
  return next
}

function mergeCompatibilityPresentation(existing, incoming) {
  if (!existing) return structuredClone(incoming)
  const next = mergeTrustedNestedMetadata(existing, incoming)
  for (const key of SERVER_OWNED_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      next[key] = structuredClone(existing[key])
    }
  }
  return next
}

function applyCompatibilityWrites(presentations, writes) {
  for (const write of writes) {
    const index = presentations.findIndex((item) => item.id === write.presentationId)
    const existing = index === -1 ? null : presentations[index]
    if (isStaleWrite(existing, write)) continue
    if (write.operation === 'remove') {
      if (index !== -1 && !isStaleWrite(existing, write)) presentations.splice(index, 1)
      continue
    }
    if (index === -1) {
      const next = structuredClone(write.presentation)
      if (typeof write.updatedAt === 'string') next.updatedAt = write.updatedAt
      presentations.push(next)
    } else {
      const next = mergeCompatibilityPresentation(existing, write.presentation)
      if (typeof write.updatedAt === 'string') next.updatedAt = write.updatedAt
      presentations[index] = next
    }
  }
}

module.exports = { applyCompatibilityWrites, mergeCompatibilityPresentation }
