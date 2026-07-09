/**
 * Phase 08c: prefer original.pptx bytes for unedited imports (zero-loss re-export).
 */
const { readOriginalPptx } = require('./original-package')
const { resolveExportStrategy } = require('./roundtrip-policy')

/**
 * @param {object} presentation
 * @param {{ forceHybrid?: boolean, edited?: boolean }} [options]
 * @returns {Promise<{ mode: string, reason: string, buffer?: Buffer, contentType?: string }>}
 */
async function resolvePptxExportPayload(presentation, options = {}) {
  const strategy = resolveExportStrategy(presentation, options)
  if (strategy.mode !== 'original-bytes') {
    return { mode: strategy.mode, reason: strategy.reason }
  }
  const id = presentation?.pptxOriginal?.id
  if (!id) {
    return { mode: 'hybrid-export', reason: 'missing-original-id' }
  }
  const buffer = await readOriginalPptx(id)
  if (!buffer) {
    return { mode: 'hybrid-export', reason: 'original-file-missing' }
  }
  // Integrity: optional sha256 check
  if (presentation.pptxOriginal.sha256) {
    const crypto = require('node:crypto')
    const actual = crypto.createHash('sha256').update(buffer).digest('hex')
    if (actual !== presentation.pptxOriginal.sha256) {
      return { mode: 'hybrid-export', reason: 'original-hash-mismatch' }
    }
  }
  return {
    mode: 'original-bytes',
    reason: strategy.reason,
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    byteLength: buffer.byteLength,
    sha256: presentation.pptxOriginal.sha256,
  }
}

/**
 * Mark presentation dirty after user edits (call from update route optionally).
 */
function markPresentationEdited(presentation) {
  if (!presentation || typeof presentation !== 'object') return presentation
  presentation._pptxEdited = true
  presentation._pptxEditedAt = new Date().toISOString()
  return presentation
}

module.exports = {
  resolvePptxExportPayload,
  markPresentationEdited,
}
