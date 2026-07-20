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
  const edited = options.edited === true || presentation?._pptxEdited === true
  if (edited && presentation?.pptxCapabilitySummary?.editedExport === 'unsupported-blocking') {
    return { mode: 'unsupported-blocking', reason: 'unsafe-complex-object-impact' }
  }
  const head = presentation?.pptxAggregateHead
  if (head?.packageRevisionId && Number.isSafeInteger(head.generation)) {
    if (head.pendingJournalHash ||
        (head.packageRevisionId === head.originalRevisionId && head.journalRevisionId)) {
      return {
        mode: 'pending-edited-export',
        reason: 'validated-edited-export-required',
      }
    }
    if (head.packageRevisionId !== head.originalRevisionId) {
      return {
        mode: 'package-head',
        reason: 'authoritative-journal-head',
        revisionId: head.packageRevisionId,
      }
    }
    return {
      mode: 'package-head',
      reason: 'authoritative-unchanged-head',
      revisionId: head.packageRevisionId,
    }
  }
  if (!shouldPreferOriginalPackage(presentation)) {
    return { mode: 'hybrid-export', reason: 'no-original-package' }
  }
  if (edited) {
    return { mode: 'hybrid-export', reason: 'edited-after-import' }
  }
  // Unedited import: prefer streaming original.pptx for true zero-loss download/re-export
  return { mode: 'original-bytes', reason: 'unedited-with-original' }
}

module.exports = {
  shouldPreferOriginalPackage,
  resolveExportStrategy,
}
