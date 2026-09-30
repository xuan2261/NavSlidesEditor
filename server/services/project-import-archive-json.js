const fs = require('fs-extra')
const { PROJECT_IMPORT_LIMITS } = require('./project-import-archive-limits')
const {
  activeContentInventory,
  digest,
  importError,
  inspectPresentation,
} = require('./project-import-archive-validation')

async function validateProjectJson(filePath, options = {}) {
  const limits = { ...PROJECT_IMPORT_LIMITS, ...(options.limits || {}) }
  const stat = await fs.stat(filePath)
  if (stat.size > limits.maxJsonBytes) {
    throw importError('PROJECT_JSON_LIMIT', 'Project JSON is too large', 413)
  }
  const bytes = await fs.readFile(filePath)
  let document
  try {
    document = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw importError('PROJECT_JSON_INVALID', 'Project JSON is invalid')
  }
  if (document?.version && !['1.0', '1.1'].includes(document.version)) {
    throw importError('PROJECT_MANIFEST_INVALID', 'Manifest version must be 1.0 or 1.1')
  }
  const presentation = document?.presentation
  inspectPresentation(presentation, limits)
  const activeContent = activeContentInventory(presentation)
  if (activeContent.length && options.trustedAuthorActiveContentAcknowledged !== true) {
    throw importError('ACTIVE_CONTENT_ACK_REQUIRED', 'Trusted author acknowledgement is required', 409, { activeContent })
  }
  return {
    archiveDigest: digest(bytes),
    payloadDigest: digest(bytes),
    manifest: document,
    presentation,
    media: [],
    activeContent,
    warnings: document?.version === '1.0' ? ['Imported legacy project JSON version 1.0'] : [],
    trustedAuthorActiveContentAcknowledged: options.trustedAuthorActiveContentAcknowledged === true,
  }
}

module.exports = { validateProjectJson }
