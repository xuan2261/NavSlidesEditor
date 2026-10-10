const { findServeablePresentation } = require('./presentation-finder')
const { normalizePptxImportedPresentationForRead } = require('./presentation-normalization')
const { getReadablePackageStore } = require('./pptx-import/package-store-runtime')
const {
  resolveEditorProjectionContext,
  verifyEditorPackageBytes,
} = require('./pptx-import/package-authority-snapshot')
const {
  hasExactCompatibilityHead,
  mergeCompatibilityPresentation,
} = require('./pptx-import/compatibility-view')
const { getTrustedImportMetadata, decorateTrustedImportMetadata } = require('./pptx-import/trusted-import-metadata')

function authorityError(reasonCode) {
  return Object.assign(new Error(reasonCode), {
    code: reasonCode,
    status: 422,
  })
}

function hasPresentationOwnedRevision(state, presentationId, revisionId) {
  const revision = state.revisions?.find((item) => item.id === revisionId)
  return Boolean(
    revision &&
    state.blobs?.some((blob) => blob.sha256 === revision.blobSha256) &&
    state.owners?.some(
      (owner) =>
        owner.ownerType === 'presentation' &&
        owner.ownerId === presentationId &&
        owner.revisionId === revisionId
    )
  )
}

function isOriginalOnlyHead(state, head) {
  const hasProjectedResult = state.mutationResults?.some(
    (result) =>
      result.presentationId === head.presentationId &&
      result.packageRevisionId === head.packageRevisionId &&
      result.projection &&
      result.sourceMap
  )
  return (
    !hasProjectedResult &&
    head.pendingJournalHash === undefined &&
    head.journalRevisionId == null &&
    head.packageRevisionId === head.originalRevisionId &&
    head.projectionRevisionId === null &&
    head.sourceMapRevisionId === null &&
    hasPresentationOwnedRevision(state, head.presentationId, head.originalRevisionId)
  )
}

function resolvePackageBackedReadFromState(
  state,
  presentationId,
  compatibilityPresentation,
  { allowIncompleteAuthority = false } = {}
) {
  const head = state.heads.find((item) => item.presentationId === presentationId)
  if (!head) {
    if (compatibilityPresentation?.pptxAggregateHead) {
      throw authorityError('PRESENTATION_PACKAGE_HEAD_MISSING')
    }
    return {
      presentation: structuredClone(compatibilityPresentation),
      generation: null,
    }
  }

  // Only a durable successor publication can authorize reading past a stale view.
  const publicationPending = compatibilityPresentation?.pptxAggregateHead?.generation < head.generation &&
    [
      ...(state.compatibilityOutbox || []),
      ...(state.compatibilityDeadLetter || []).map((entry) => entry.write),
    ].some((write) => write?.operation === 'upsert' &&
      write.presentationId === presentationId &&
      hasExactCompatibilityHead(write.presentation, head))
  if (!hasExactCompatibilityHead(compatibilityPresentation, head) && !publicationPending &&
      (compatibilityPresentation?.pptxAggregateHead || !isOriginalOnlyHead(state, head))) {
    throw authorityError('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
  }

  const originalAvailable = hasPresentationOwnedRevision(
    state,
    presentationId,
    head.originalRevisionId
  )
  const packageAvailable = hasPresentationOwnedRevision(
    state,
    presentationId,
    head.packageRevisionId
  )
  if (!originalAvailable || (!packageAvailable && !allowIncompleteAuthority)) {
    throw authorityError('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
  }
  if (!packageAvailable) {
    const presentation = structuredClone(compatibilityPresentation)
    presentation.id = presentationId
    presentation.pptxAggregateHead = structuredClone(head)
    return { presentation, generation: head.generation }
  }

  const context = resolveEditorProjectionContext(state, presentationId)
  if (!context.ok) {
    if (!allowIncompleteAuthority && !isOriginalOnlyHead(state, head)) {
      throw authorityError(context.reasonCode)
    }
    const presentation = structuredClone(compatibilityPresentation)
    presentation.id = presentationId
    presentation.pptxAggregateHead = structuredClone(head)
    return { presentation, generation: head.generation }
  }

  const presentation = decorateTrustedImportMetadata(
    mergeCompatibilityPresentation(compatibilityPresentation, context.after),
    getTrustedImportMetadata(state, head)
  )
  presentation.id = presentationId
  presentation.pptxAggregateHead = structuredClone(head)
  return { presentation, generation: head.generation }
}

async function resolvePackageBackedRead(presentationId, compatibilityPresentation, options = {}) {
  const store = await getReadablePackageStore()
  const resolved = resolvePackageBackedReadFromState(
    store.getState(),
    presentationId,
    compatibilityPresentation,
    options
  )
  if (resolved.generation !== null)
    await verifyEditorPackageBytes(store, resolved.presentation.pptxAggregateHead)
  return resolved
}

async function readAuthoritativePresentation(
  presentationId,
  { normalize = true, allowIncompleteAuthority = false } = {}
) {
  const storedPresentation = await findServeablePresentation(presentationId, { normalize: false })
  if (!storedPresentation) return null
  const compatibilityPresentation = normalize
    ? normalizePptxImportedPresentationForRead(storedPresentation)
    : storedPresentation
  return resolvePackageBackedRead(presentationId, compatibilityPresentation, {
    allowIncompleteAuthority,
  })
}

const BULK_QUARANTINE_CODES = new Set([
  'PRESENTATION_PACKAGE_HEAD_MISSING',
  'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
  'CANONICAL_TEXT_JOURNAL_INVALID',
  'STALE_MATRIX_AUTHORITY',
])

/**
 * Bulk authoritative read with list isolation.
 * Known missing-head / authority failures are quarantined (optional collectQuarantine)
 * so healthy rows remain readable. Single-read paths stay fail-closed.
 */
async function readAuthoritativePresentations(
  storedPresentations,
  { normalize = true, collectQuarantine = null } = {}
) {
  const serveable = (storedPresentations || []).filter(
    (presentation) => presentation && !presentation.deletedAt
  )
  if (!serveable.length) return []
  const store = await getReadablePackageStore()
  const state = store.getState()
  const results = []
  for (const storedPresentation of serveable) {
    const compatibilityPresentation = normalize
      ? normalizePptxImportedPresentationForRead(storedPresentation)
      : storedPresentation
    try {
      const resolved = resolvePackageBackedReadFromState(
        state,
        storedPresentation.id,
        compatibilityPresentation
      )
      if (resolved.generation !== null)
        await verifyEditorPackageBytes(store, resolved.presentation.pptxAggregateHead)
      results.push(resolved)
    } catch (err) {
      if (BULK_QUARANTINE_CODES.has(err?.code)) {
        if (Array.isArray(collectQuarantine)) {
          collectQuarantine.push({
            id: storedPresentation.id,
            code: err.code,
            status: err.status || 422,
          })
        }
        continue
      }
      throw err
    }
  }
  return results
}

module.exports = {
  BULK_QUARANTINE_CODES,
  readAuthoritativePresentation,
  readAuthoritativePresentations,
  resolvePackageBackedRead,
  resolvePackageBackedReadFromState,
}
