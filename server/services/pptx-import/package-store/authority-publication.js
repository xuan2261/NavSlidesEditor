const { queueCompatibilityUpsert } = require('../compatibility-outbox')
const { mergeCompatibilityPresentation } = require('../compatibility-view')
const { resolveEditedExportContext } = require('../validated-edited-export-context')
const { getTrustedImportMetadata } = require('../trusted-import-metadata')

// Canonical authority does not imply admission to the presentation collection.
// Only an explicit queued publication may create a row; epoch refreshes without
// that intent update existing rows, including Original-only presentations.
function refreshCompatibilityHeads(state, { skipPresentationId } = {}) {
  for (const head of state.heads) {
    if (head.presentationId === skipPresentationId) continue
    const queued = [...(state.compatibilityOutbox || [])].reverse().find((write) =>
      write.operation === 'upsert' && write.presentationId === head.presentationId &&
      write.headOnly !== true)
    const context = queued ? resolveEditedExportContext(state, head.presentationId) : null
    const publication = queued && (context.ok
      ? mergeCompatibilityPresentation(queued.presentation, context.after)
      : queued.presentation)
    queueCompatibilityUpsert(state, {
      presentationId: head.presentationId,
      generation: head.generation,
      ...(queued?.updatedAt ? { updatedAt: queued.updatedAt } : {}),
      ...(context?.ok ? { trustedImportMetadata: getTrustedImportMetadata(state, head) } : {}),
      headOnly: !queued,
      presentation: {
        ...(publication ? structuredClone(publication) : {}),
        id: head.presentationId,
        pptxAggregateHead: structuredClone(head),
      },
    })
  }
}

module.exports = { refreshCompatibilityHeads }
