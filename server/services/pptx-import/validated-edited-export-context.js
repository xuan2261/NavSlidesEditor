const { hashRecord } = require('./package-store/schemas')
const { transportFromTipTapContent } = require('./tiptap-single-plain-run-eligibility')
const { MUTATION_OPERATIONS } = require('./mutation-operation-scope')

function failed(reasonCode) {
  return Object.freeze({ ok: false, reasonCode })
}

function matchingResults(state, presentationId, packageRevisionId, stateName) {
  return (state.mutationResults || []).filter((result) =>
    result.presentationId === presentationId &&
    result.packageRevisionId === packageRevisionId &&
    result.state === stateName &&
    result.projection &&
    result.sourceMap
  )
}

function hasAllowedOperation(result, operations) {
  return result.operation === undefined || operations.includes(result.operation)
}

function withoutTextContent(value) {
  if (Array.isArray(value)) return value.map(withoutTextContent)
  if (!value || typeof value !== 'object') return value
  const isTextElement = value.type === 'text'
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !(isTextElement && key === 'content'))
    .map(([key, child]) => [key, withoutTextContent(child)]))
}

function hasNonTextChanges(before, after) {
  return hashRecord(withoutTextContent(before)) !== hashRecord(withoutTextContent(after))
}

function serverTextTransports(projection) {
  const transports = {}
  function visitSlides(slides) {
    if (!Array.isArray(slides)) throw new TypeError('Server projection slides are invalid')
    for (const slide of slides) {
      if (!slide || typeof slide !== 'object' || typeof slide.id !== 'string' ||
          !Array.isArray(slide.elements)) throw new TypeError('Server projection slide is invalid')
      for (const element of slide.elements) {
        if (!element || typeof element !== 'object' || typeof element.id !== 'string') {
          throw new TypeError('Server projection element is invalid')
        }
        if (element.type === 'text') {
          transports[`${slide.id}:${element.id}`] = transportFromTipTapContent(element.content)
        }
      }
      if (slide.children !== undefined) visitSlides(slide.children)
    }
  }
  visitSlides(projection?.slides)
  return Object.freeze(transports)
}

function isLegacyValidatedResult(result) {
  return result.operation === undefined &&
    result.state === 'committed' &&
    result.projection && result.sourceMap && result.journal &&
    Array.isArray(result.operationIds)
}

function isCommittedAuthority(result) {
  return (result.operation === undefined && result.state === 'committed' &&
    result.projection && result.sourceMap) ||
    result.operation === MUTATION_OPERATIONS.PACKAGE_IMPORT ||
    result.operation === MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT
}

function matchesHeadAuthority(result, head) {
  return result.projection && result.sourceMap &&
    head.projectionRevisionId === hashRecord(result.projection) &&
    head.sourceMapRevisionId === hashRecord(result.sourceMap)
}

function resolveEditedExportContext(state, presentationId) {
  const head = state?.heads?.find((item) => item.presentationId === presentationId)
  if (!head) return failed('PRESENTATION_PACKAGE_HEAD_MISSING')
  let pending = null
  if (head.pendingJournalHash !== undefined) {
    const candidates = matchingResults(state, presentationId, head.packageRevisionId, 'pending-edited-export')
      .filter((result) => hasAllowedOperation(result, [MUTATION_OPERATIONS.PROJECTION_SAVE]) &&
        result.generation === head.generation &&
        (result.journal?.baseRevisionId === undefined ||
          result.journal?.baseRevisionId === head.packageRevisionId) &&
        result.journal?.journalHash === head.pendingJournalHash)
    if (head.journalRevisionId !== head.pendingJournalHash || candidates.length !== 1) {
      return failed('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
    }
    pending = candidates[0]
  }
  const committedResults = matchingResults(state, presentationId, head.packageRevisionId, 'committed')
    .filter(isCommittedAuthority)
  const committed = committedResults
    .filter((result) => pending
      ? result.generation === head.generation - 1 &&
        result.sourceMap?.packageGeneration === head.generation - 1
      : matchesHeadAuthority(result, head))
    .at(-1)
  if (!committed) return failed('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
  const after = pending?.projection || committed.projection
  const sourceMap = pending?.sourceMap || committed.sourceMap
  if (committed.projection.id !== presentationId || after?.id !== presentationId ||
      sourceMap?.presentationId !== presentationId ||
      sourceMap.revisionId !== head.packageRevisionId ||
      sourceMap.packageGeneration !== head.generation) {
    return failed('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
  }
  try {
    if (pending && hasNonTextChanges(committed.projection, after)) {
      return failed('CANONICAL_TEXT_JOURNAL_INVALID')
    }
    return Object.freeze({
      ok: true,
      head,
      before: committed.projection,
      after,
      sourceMap,
      pendingJournalHash: head.pendingJournalHash,
      textTransports: serverTextTransports(after),
      pendingEdit: Boolean(pending && hashRecord(committed.projection) !== hashRecord(after)),
    })
  } catch {
    return failed('CANONICAL_TEXT_JOURNAL_INVALID')
  }
}

function replayRequest(state, request) {
  const head = state?.heads?.find((item) => item.presentationId === request.presentationId)
  const prior = (state?.mutationResults || []).find((result) =>
    (result.operation === MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT ||
      isLegacyValidatedResult(result)) &&
    result.presentationId === request.presentationId &&
    result.idempotencyKey === request.idempotencyKey
  )
  const baseRevisionId = prior?.requestIdentity?.baseRevisionId
  const expectedGenerationMatches = prior?.requestIdentity
    ? prior.requestIdentity.expectedGeneration === request.expectedGeneration
    : prior?.generation === request.expectedGeneration + 1
  if (!head || !prior?.projection ||
      prior.packageRevisionId !== head.packageRevisionId ||
      prior.generation !== head.generation ||
      !expectedGenerationMatches ||
      (baseRevisionId !== null && typeof baseRevisionId !== 'string')) return null
  try {
    return Object.freeze({
      presentationId: request.presentationId,
      expectedGeneration: request.expectedGeneration,
      idempotencyKey: request.idempotencyKey,
      cancelled: request.cancelled === true,
      requireOfficeCli: true,
      baseRevisionId: baseRevisionId || undefined,
      after: prior.projection,
      textTransports: serverTextTransports(prior.projection),
      pendingEdit: Array.isArray(prior.journal?.operations) && prior.journal.operations.length > 0,
      compatibilityPresentation: prior.projection,
    })
  } catch {
    return null
  }
}

module.exports = { replayRequest, resolveEditedExportContext, serverTextTransports }
