function pick(record, fields) {
  return Object.fromEntries(
    fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]])
  )
}

function toServerRecord(record) {
  return pick(record, [
    'schemaVersion',
    'id',
    'sha256',
    'byteLength',
    'generation',
    'uploadedAt',
    'blobSha256',
    'ordinal',
    'manifestHash',
    'fencingEpoch',
    'predecessorId',
  ])
}

function toEditorDto(record) {
  return pick(record, ['id', 'sha256', 'byteLength', 'generation', 'uploadedAt'])
}

function toPresentationEditorDto(record, { aggregateGeneration } = {}) {
  const dto = stripAuthority(record)
  const original = toEditorDto(record.pptxOriginal || {})
  if (Object.keys(original).length) dto.pptxOriginal = original
  if (record.pptxAggregateHead?.packageRevisionId || Object.keys(original).length) {
    dto.pptxSourceAvailable = true
  }
  if (Number.isSafeInteger(aggregateGeneration)) dto.aggregateGeneration = aggregateGeneration
  return dto
}

function toPublicDto(record) {
  return pick(record, ['id', 'byteLength', 'capabilitySummary'])
}

function toProviderDto(record) {
  return pick(record, ['id', 'sha256', 'byteLength'])
}

const SAFE_PPTX_METADATA_KEYS = new Set([
  '_pptxMeta',
  '_pptxImportMeta',
  '_pptxChartMeta',
])
const AUTHORITY_KEYS = /^(?:_?pptx.*|.*(?:aggregateHead|capability|validatedRevision|packageRevision|journal|authority).*|.*source(?:Map|Ref|Authority).*|(?:aggregateGeneration|baseRevisionId|idempotencyKey|blobSha256|sha256|generation|ordinal|fencingEpoch|predecessorId|originalRevisionId|projectionRevisionId|revisionId|manifestHash|originalPath|packagePath|complexObjects|relationships|securityFlags|unknownParts))$/i

function isAuthorityKey(key) {
  return !SAFE_PPTX_METADATA_KEYS.has(key) && AUTHORITY_KEYS.test(key)
}

function stripAuthority(value, { retainGeneration = false } = {}) {
  if (Array.isArray(value)) return value.map((item) => stripAuthority(item, { retainGeneration }))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => (retainGeneration && key === 'aggregateGeneration') ||
      (!isAuthorityKey(key) && key !== 'aggregateGeneration'))
    .map(([key, child]) => [key, stripAuthority(child, { retainGeneration })]))
}

module.exports = {
  stripAuthority,
  toEditorDto,
  toPresentationEditorDto,
  toProviderDto,
  toPublicDto,
  toServerRecord,
}
