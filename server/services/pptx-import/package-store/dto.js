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
  if (dto._pptxImportReport) {
    const report = toEditorImportReport(dto._pptxImportReport)
    if (report) dto._pptxImportReport = report
    else delete dto._pptxImportReport
  }
  const original = toEditorDto(record.pptxOriginal || {})
  if (Object.keys(original).length) dto.pptxOriginal = original
  if (record.pptxAggregateHead?.packageRevisionId || Object.keys(original).length) {
    dto.pptxSourceAvailable = true
  }
  if (Number.isSafeInteger(aggregateGeneration)) dto.aggregateGeneration = aggregateGeneration
  return dto
}

function toExternalPresentationDto(record) {
  // External/export DTOs must not carry job IDs, raw diagnostics, or authority.
  const external = stripAuthority(record)
  if (external?._pptxImportReport) {
    const { toReportSummary } = require('../import-report')
    const summary = toReportSummary(external._pptxImportReport)
    if (summary) external._pptxImportReport = summary
    else delete external._pptxImportReport
  }
  return external
}

function toPublicDto(record) {
  return pick(record, ['id', 'byteLength', 'capabilitySummary'])
}

function toProviderDto(record) {
  return pick(record, ['id', 'sha256', 'byteLength'])
}

const { sanitizeImportReport, toEditorImportReport } = require('../import-report')

const SAFE_PPTX_METADATA_KEYS = new Set([
  '_pptxMeta',
  '_pptxImportMeta',
  '_pptxChartMeta',
  '_pptxImportReport',
])
const SAFE_CHART_METADATA_KEYS = new Set([
  'originalType',
  'barDir',
  'holeSize',
  'marker',
  'grouping',
  'is3D',
  'combo',
  'comboDetected',
  'comboFamily',
])
const AUTHORITY_KEYS = /^(?:_?pptx.*|.*(?:aggregateHead|capability|validatedRevision|packageRevision|journal|authority).*|.*source(?:Map|Ref|Authority).*|(?:aggregateGeneration|baseRevisionId|idempotencyKey|blobSha256|sha256|generation|ordinal|fencingEpoch|predecessorId|originalRevisionId|projectionRevisionId|revisionId|manifestHash|originalPath|packagePath|complexObjects|relationships|securityFlags|unknownParts))$/i

function isAuthorityKey(key) {
  return !SAFE_PPTX_METADATA_KEYS.has(key) && AUTHORITY_KEYS.test(key)
}

function isSafeChartMetadataValue(value) {
  return value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean'
}

function sanitizeChartMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter(([key, child]) => SAFE_CHART_METADATA_KEYS.has(key) && isSafeChartMetadataValue(child)))
}

function safeNumberMap(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const result = Object.fromEntries(Object.entries(value)
    .filter(([key, child]) => keys.has(key) && typeof child === 'number' && Number.isFinite(child)))
  return Object.keys(result).length ? result : undefined
}

function sanitizePptxMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const originalSize = safeNumberMap(value.originalSize, new Set(['width', 'height']))
  return originalSize ? { originalSize } : {}
}

function sanitizePptxImportMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  const scalarKeys = new Set([
    'version',
    'textFit',
    'sourceFontSizePx',
    'fitFontSizePx',
    'textLength',
    'textInsetsUnit',
    'sourceCrop',
    '_pptxSharpen',
    '_pptxColorTemp',
  ])
  for (const [key, child] of Object.entries(value)) {
    if (scalarKeys.has(key) && isSafeChartMetadataValue(child)) result[key] = child
  }
  const textInsets = safeNumberMap(value.textInsets, new Set(['left', 'right', 'top', 'bottom']))
  const cropData = safeNumberMap(value.cropData, new Set(['top', 'bottom', 'left', 'right']))
  const sourceBox = safeNumberMap(value.sourceBox, new Set(['width', 'height']))
  if (textInsets) result.textInsets = textInsets
  if (cropData) result.cropData = cropData
  if (sourceBox) result.sourceBox = sourceBox
  return result
}

function stripAuthority(value, { retainGeneration = false } = {}) {
  if (Array.isArray(value)) return value.map((item) => stripAuthority(item, { retainGeneration }))
  if (!value || typeof value !== 'object') return value
  const entries = []
  for (const [key, child] of Object.entries(value)) {
    if (retainGeneration && key === 'aggregateGeneration') {
      entries.push([key, child])
      continue
    }
    if (key === '_pptxMeta') {
      const metadata = sanitizePptxMetadata(child)
      if (Object.keys(metadata).length) entries.push([key, metadata])
      continue
    }
    if (key === '_pptxImportMeta') {
      const metadata = sanitizePptxImportMetadata(child)
      if (Object.keys(metadata).length) entries.push([key, metadata])
      continue
    }
    if (key === '_pptxChartMeta') {
      const chartMetadata = sanitizeChartMetadata(child)
      if (Object.keys(chartMetadata).length) entries.push([key, chartMetadata])
      continue
    }
    if (key === '_pptxImportReport') {
      const report = sanitizeImportReport(child)
      if (report) entries.push([key, report])
      continue
    }
    if (isAuthorityKey(key) || key === 'aggregateGeneration') continue
    entries.push([key, stripAuthority(child, { retainGeneration })])
  }
  return Object.fromEntries(entries)
}

module.exports = {
  sanitizeChartMetadata,
  sanitizePptxImportMetadata,
  sanitizePptxMetadata,
  stripAuthority,
  toEditorDto,
  toExternalPresentationDto,
  toPresentationEditorDto,
  toProviderDto,
  toPublicDto,
  toServerRecord,
}
