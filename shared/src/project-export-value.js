// Shared by browser project archives and agent JSON exports. Keep authority fields private.
const PROJECT_EXPORT_OMITTED_KEYS = new Set([
  '_pptxImportReport', '_pptxSource', '_pptxEdited', '_pptxEditedAt',
  'pptxOriginal', 'pptxAggregateHead', 'pptxSourceAvailable', 'aggregateGeneration',
  'createdAt', 'updatedAt', 'deletedAt', 'jobId', 'controlCapabilityHash',
  'capabilityHash', 'sha256', 'byteLength', 'revisionId', 'packageRevisionId',
  'sourceMapRevisionId', 'projectionRevisionId', 'originalRevisionId', 'manifestHash',
  'blobSha256', 'fencingEpoch', 'predecessorId', 'originalPath', 'packagePath',
  'sourceMap', 'sourceAuthority', 'sourceRef', 'relationships', 'complexObjects',
  'unknownParts', 'securityFlags',
])

function projectExportValue(value) {
  if (Array.isArray(value)) return value.map(projectExportValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PROJECT_EXPORT_OMITTED_KEYS.has(key))
      .map(([key, child]) => [key, projectExportValue(child)])
  )
}

module.exports = { projectExportValue }
