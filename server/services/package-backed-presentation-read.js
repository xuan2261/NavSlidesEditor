const { findServeablePresentation } = require('./presentation-finder')
const { normalizePptxImportedPresentationForRead } = require('./presentation-normalization')
const { getReadablePackageStore } = require('./pptx-import/package-store-runtime')
const { resolveEditedExportContext } = require('./pptx-import/validated-edited-export-context')
const { mergeCompatibilityPresentation } = require('./pptx-import/compatibility-view')
const { hashRecord } = require('./pptx-import/package-store/schemas')

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
    state.owners?.some((owner) =>
      owner.ownerType === 'presentation' &&
      owner.ownerId === presentationId &&
      owner.revisionId === revisionId
    )
  )
}

function isOriginalOnlyHead(state, head) {
  const hasProjectedResult = state.mutationResults?.some((result) =>
    result.presentationId === head.presentationId &&
    result.packageRevisionId === head.packageRevisionId &&
    result.projection && result.sourceMap
  )
  return !hasProjectedResult &&
    head.pendingJournalHash === undefined &&
    head.journalRevisionId == null &&
    head.packageRevisionId === head.originalRevisionId &&
    head.projectionRevisionId === null &&
    head.sourceMapRevisionId === null &&
    hasPresentationOwnedRevision(state, head.presentationId, head.originalRevisionId)
}

function hasConsistentAuthorityPointers(head, context) {
  return context.sourceMap &&
    head.projectionRevisionId === hashRecord(context.after) &&
    head.sourceMapRevisionId === hashRecord(context.sourceMap) &&
    (context.pendingJournalHash === undefined
      ? head.journalRevisionId == null
      : head.journalRevisionId === context.pendingJournalHash)
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

  const context = resolveEditedExportContext(state, presentationId)
  if (!context.ok) {
    if (!allowIncompleteAuthority && !isOriginalOnlyHead(state, head)) {
      throw authorityError(context.reasonCode)
    }
    const presentation = structuredClone(compatibilityPresentation)
    presentation.id = presentationId
    presentation.pptxAggregateHead = structuredClone(head)
    return { presentation, generation: head.generation }
  }
  if (!hasConsistentAuthorityPointers(head, context)) {
    throw authorityError('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
  }

  const presentation = mergeCompatibilityPresentation(
    compatibilityPresentation,
    context.after
  )
  presentation.id = presentationId
  presentation.pptxAggregateHead = structuredClone(head)
  return { presentation, generation: head.generation }
}

async function resolvePackageBackedRead(
  presentationId,
  compatibilityPresentation,
  options = {}
) {
  const store = await getReadablePackageStore()
  return resolvePackageBackedReadFromState(
    store.getState(),
    presentationId,
    compatibilityPresentation,
    options
  )
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
  return resolvePackageBackedRead(
    presentationId,
    compatibilityPresentation,
    { allowIncompleteAuthority }
  )
}

async function readAuthoritativePresentations(storedPresentations, { normalize = true } = {}) {
  const serveable = (storedPresentations || []).filter((presentation) =>
    presentation && !presentation.deletedAt
  )
  if (!serveable.length) return []
  const store = await getReadablePackageStore()
  const state = store.getState()
  return serveable.map((storedPresentation) => {
    const compatibilityPresentation = normalize
      ? normalizePptxImportedPresentationForRead(storedPresentation)
      : storedPresentation
    return resolvePackageBackedReadFromState(
      state,
      storedPresentation.id,
      compatibilityPresentation
    )
  })
}

module.exports = {
  readAuthoritativePresentation,
  readAuthoritativePresentations,
  resolvePackageBackedRead,
}
