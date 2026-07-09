/**
 * Phase 08c: re-export policy — prefer original package parts for unedited nodes.
 * Full package-open oracle lands later; this module defines the contract.
 */

function shouldPreferOriginalPackage(presentation) {
  return Boolean(presentation?.pptxOriginal?.id && presentation?.pptxOriginal?.sha256)
}

/**
 * Decide export strategy for a presentation.
 * @returns {{ mode: 'original-bytes'|'hybrid-export', reason: string }}
 */
function resolveExportStrategy(presentation, options = {}) {
  if (options.forceHybrid) {
    return { mode: 'hybrid-export', reason: 'forced' }
  }
  if (!shouldPreferOriginalPackage(presentation)) {
    return { mode: 'hybrid-export', reason: 'no-original-package' }
  }
  if (options.edited === true || presentation?._pptxEdited === true) {
    return { mode: 'hybrid-export', reason: 'edited-after-import' }
  }
  // Unedited import: prefer streaming original.pptx for true zero-loss download/re-export
  return { mode: 'original-bytes', reason: 'unedited-with-original' }
}

module.exports = {
  shouldPreferOriginalPackage,
  resolveExportStrategy,
}
