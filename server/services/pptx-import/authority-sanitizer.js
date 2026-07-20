const SAFE_PPTX_METADATA_KEYS = new Set([
  '_pptxMeta',
  '_pptxImportMeta',
  '_pptxChartMeta',
])
const AUTHORITY_KEY = /^(?:_?pptx.*|.*(?:aggregateHead|capability|validatedRevision|packageRevision|journal|authority).*|.*source(?:Map|Ref|Authority).*|(?:aggregateGeneration|baseRevisionId|idempotencyKey|blobSha256|sha256|generation|ordinal|fencingEpoch|predecessorId|originalRevisionId|projectionRevisionId|revisionId|manifestHash|originalPath|packagePath|serverPath|filePath|complexObjects|relationships|securityFlags|unknownParts))$/i

function isAuthorityKey(key) {
  return !SAFE_PPTX_METADATA_KEYS.has(key) && AUTHORITY_KEY.test(key)
}

function sanitizeClientEditableData(value) {
  if (Array.isArray(value)) return value.map(sanitizeClientEditableData)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isAuthorityKey(key))
      .map(([key, child]) => [key, sanitizeClientEditableData(child)])
  )
}

module.exports = { sanitizeClientEditableData }
