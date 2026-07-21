const {
  sanitizeChartMetadata,
  sanitizePptxImportMetadata,
  sanitizePptxMetadata,
} = require('./package-store/dto')

const SAFE_PPTX_METADATA_KEYS = new Set([
  '_pptxMeta',
  '_pptxImportMeta',
  '_pptxChartMeta',
])
const AUTHORITY_KEY = /^(?:_?pptx.*|.*(?:aggregateHead|capability|validatedRevision|packageRevision|journal|authority).*|.*source(?:Map|Ref|Authority).*|(?:aggregateGeneration|baseRevisionId|idempotencyKey|blobSha256|sha256|generation|ordinal|fencingEpoch|predecessorId|originalRevisionId|projectionRevisionId|revisionId|manifestHash|originalPath|packagePath|serverPath|filePath|complexObjects|relationships|securityFlags|unknownParts|createdAt|updatedAt|deletedAt))$/i

const ROOT_TIMESTAMP_KEYS = new Set(['createdAt', 'updatedAt', 'deletedAt'])

function isAuthorityKey(key, isRoot) {
  return !SAFE_PPTX_METADATA_KEYS.has(key) && AUTHORITY_KEY.test(key) &&
    (isRoot || !ROOT_TIMESTAMP_KEYS.has(key))
}

function sanitizeClientEditableData(value, isRoot = true) {
  if (Array.isArray(value)) return value.map((child) => sanitizeClientEditableData(child, false))
  if (!value || typeof value !== 'object') return value
  const entries = []
  for (const [key, child] of Object.entries(value)) {
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
    if (isAuthorityKey(key, isRoot)) continue
    entries.push([key, sanitizeClientEditableData(child, false)])
  }
  return Object.fromEntries(entries)
}

module.exports = { sanitizeClientEditableData }
