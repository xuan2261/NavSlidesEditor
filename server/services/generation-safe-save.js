const { normalizePresentationGames } = require('revealjs-shared')
const { canonicalSaveSnapshot, freezeCanonicalSaveSnapshot } = require('./pptx-import/canonical-snapshot')
const { assertSemanticBaseline } = require('./pptx-import/semantic-baseline')
const { validatePictureReplacements } = require('./pptx-import/picture-replacement-validation')
const { getReadablePackageStore, withPackageStore } = require('./pptx-import/package-store-runtime')
const {
  deriveMutationJournal,
} = require('./pptx-import/mutation-journal')
const { hashRecord, RECORD_SCHEMA_VERSION } = require('./pptx-import/package-store/schemas')
const { rebindSourceMap } = require('./pptx-import/source-map')
const { recordVerifiedJournal, retainPublishedSaveReceipts } = require('./pptx-import/package-authority-snapshot')
const { mergeCompatibilityPresentation } = require('./pptx-import/compatibility-view')
const { validateMatrixAuthoritySubjects } = require('./pptx-import/canonical-feature-matrix')
const { canonicalReasonCodes, reasonCodeSubject } = require('./pptx-import/reason-code-contract')
const { isValidIdempotencyKey } = require('./pptx-import/request-limits')
const { MUTATION_OPERATIONS } = require('./pptx-import/mutation-operation-scope')
const {
  getTrustedImportMetadata,
  decorateTrustedImportMetadata,
} = require('./pptx-import/trusted-import-metadata')

const OPERATION = MUTATION_OPERATIONS.PROJECTION_SAVE

function currentAuthority(state, head) {
  return (
    [...state.mutationResults]
      .reverse()
      .find(
        (result) =>
          result.presentationId === head.presentationId &&
          result.packageRevisionId === head.packageRevisionId &&
          result.sourceMap &&
          result.projection
      ) || null
  )
}

function isLegacyProjectionSaveResult(result) {
  return (
    result?.operation === undefined &&
    result.state === 'pending-edited-export' &&
    result.projection &&
    result.sourceMap &&
    result.journal &&
    Array.isArray(result.operationIds)
  )
}

function compatibilityPresentation(stored, projection, presentationId) {
  return {
    ...stored,
    ...projection,
    id: presentationId,
  }
}
function denied(status, reasonCode, extra = {}) {
  const reasonCodes = canonicalReasonCodes([reasonCode])
  return {
    ok: false,
    packageBacked: true,
    status,
    reason: reasonCodes[0],
    blockReason: reasonCodes[0],
    reasonCode: reasonCodes[0],
    reasonCodes,
    reasonCodeSubject: reasonCodeSubject(),
    ...extra,
  }
}

async function savePackageProjection({
  presentationId,
  expectedGeneration,
  baseRevisionId,
  idempotencyKey,
  after,
  loadStored,
}) {
  return withPackageStore(async (store) => {
    // Package serialization owns this recursively sealed publication. Keep its
    // admitted semantic identities; public getState() detaches the entire history.
    // All successor writes use the closed projection-save transaction below.
    const state = store.getOwnedAuthorityState()
    const head = state.heads.find((item) => item.presentationId === presentationId)
    if (!head) return { packageBacked: false }
    if (expectedGeneration === undefined || idempotencyKey === undefined) {
      return denied(428, 'PACKAGE_SAVE_ENVELOPE_REQUIRED')
    }
    if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1) {
      return denied(400, 'INVALID_EXPECTED_GENERATION')
    }
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return denied(400, 'INVALID_IDEMPOTENCY_KEY')
    }
    if (
      baseRevisionId !== undefined &&
      (typeof baseRevisionId !== 'string' || !baseRevisionId.trim() || baseRevisionId.length > 200)
    ) {
      return denied(400, 'INVALID_BASE_REVISION')
    }
    const authority = currentAuthority(state, head)
    // Capture publication-owned metadata under package serialization, never after
    // the drain (which may already have published a successor generation).
    const publication = await loadStored()
    const stored = authority?.projection || publication
    if (!stored) return denied(404, 'NOT_FOUND')
    const canonicalBefore = authority
      ? store.getAuthoritativeSaveSnapshot(presentationId, head)
      : canonicalSaveSnapshot(stored)
    const canonicalAfter = canonicalSaveSnapshot(
      normalizePresentationGames({ ...stored, ...after, id: presentationId })
    )
    assertSemanticBaseline(canonicalBefore, canonicalAfter)
    freezeCanonicalSaveSnapshot(canonicalBefore)
    freezeCanonicalSaveSnapshot(canonicalAfter)
    const trustedImportMetadata = getTrustedImportMetadata(state, head)
    const compatibility = decorateTrustedImportMetadata(
      mergeCompatibilityPresentation(publication, compatibilityPresentation(stored, canonicalAfter, presentationId)),
      trustedImportMetadata
    )
    // Metadata decoration may clone the graph. Restore only the owned, admitted
    // semantic output, so the DTO can validate via its immutable certificate.
    if (canonicalAfter.pptxSemantic) compatibility.pptxSemantic = canonicalAfter.pptxSemantic
    const responsePublication = (projection, aggregateHead, updatedAt) => {
      // Reuse preparation only for this exact admitted projection and committed
      // head. A replay may carry another projection identity; never reuse by
      // generation alone, or consult the store again after compatibility drain.
      const prepared = projection === canonicalAfter &&
        aggregateHead?.presentationId === presentationId &&
        aggregateHead.generation === expectedGeneration + 1 &&
        aggregateHead.packageRevisionId === head.packageRevisionId &&
        aggregateHead.projectionRevisionId === hashRecord(projection)
        ? compatibility
        : decorateTrustedImportMetadata(
          mergeCompatibilityPresentation(publication, projection), trustedImportMetadata
        )
      // Every editable field, including publication metadata, belongs to the
      // response. Only an admitted, recursively immutable semantic graph shares.
      const { pptxSemantic: _semantic, ...editable } = prepared
      const response = structuredClone(editable)
      if (projection.pptxSemantic) response.pptxSemantic = projection.pptxSemantic
      return {
        ...response,
        id: presentationId,
        pptxAggregateHead: structuredClone(aggregateHead),
        ...(updatedAt ? { updatedAt } : {}),
      }
    }
    const sourceMap = authority?.sourceMap
    // A normal save only publishes the canonical projection and pending journal.
    // Only the validated edited-export workflow may materialize a successor package revision.
    const requestHash = hashRecord({
      operation: OPERATION,
      presentationId,
      expectedGeneration,
      baseRevisionId: baseRevisionId || null,
      after,
    })
    const prior = state.mutationResults.find(
      (item) =>
        (item.operation === OPERATION || isLegacyProjectionSaveResult(item)) &&
        item.presentationId === presentationId &&
        item.idempotencyKey === idempotencyKey
    )
    if (prior) {
      const replay = prior.requestIdentity
        ? prior.requestIdentity.expectedGeneration === expectedGeneration &&
          prior.requestIdentity.baseRevisionId === (baseRevisionId || null) &&
          prior.requestIdentity.snapshotHash === hashRecord(canonicalAfter)
        : isLegacyProjectionSaveResult(prior) &&
          expectedGeneration === prior.generation - 1 &&
          (baseRevisionId === undefined || baseRevisionId === prior.packageRevisionId) &&
          (!prior.journal?.baseRevisionId ||
            prior.journal.baseRevisionId === prior.packageRevisionId) &&
          hashRecord(canonicalAfter) === hashRecord(prior.projection)
      const sameRequest = prior.requestHash === requestHash || replay
      if (!sameRequest) return denied(409, 'IDEMPOTENCY_KEY_CONFLICT')
      if (
        prior.packageRevisionId !== head.packageRevisionId ||
        prior.generation !== head.generation
      ) {
        return denied(409, 'STALE_GENERATION', { currentGeneration: head.generation })
      }
      return {
        ok: true,
        packageBacked: true,
        idempotent: true,
        generation: prior.generation,
        aggregateHead: store.getPresentationHead(presentationId),
        projection: prior.projection,
        projectionHash: hashRecord(prior.projection),
        responsePresentation: responsePublication(
          freezeCanonicalSaveSnapshot(canonicalSaveSnapshot(prior.projection)),
          store.getPresentationHead(presentationId),
          state.compatibilityOutbox?.find((write) => write.presentationId === presentationId &&
            write.generation === prior.generation)?.updatedAt || publication?.updatedAt
        ),
      }
    }
    if (head.generation !== expectedGeneration) {
      return denied(409, 'STALE_GENERATION', { currentGeneration: head.generation })
    }
    if (
      head.matrixAuthorityEpoch !== state.matrixAuthorityEpoch ||
      !validateMatrixAuthoritySubjects(
        head.matrixAuthoritySubjects,
        undefined,
        state.matrixAuthorityEpoch
      ).authorized
    ) {
      return denied(422, 'STALE_MATRIX_AUTHORITY')
    }
    if (baseRevisionId !== undefined && baseRevisionId !== head.packageRevisionId) {
      return denied(409, 'BASE_REVISION_MISMATCH', {
        currentGeneration: head.generation,
        currentRevisionId: head.packageRevisionId,
      })
    }
    if (!sourceMap) return denied(422, 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
    await validatePictureReplacements(canonicalAfter, canonicalBefore)
    const projectionHash = hashRecord(canonicalAfter)
    const journal = deriveMutationJournal(canonicalBefore, canonicalAfter, {
      baseRevisionId: head.packageRevisionId,
      sourceMap,
      matrixAuthorityEpoch: state.matrixAuthorityEpoch,
    })
    const generation = head.generation + 1
    const successorSourceMap = rebindSourceMap(sourceMap, {
      presentationId,
      revisionId: head.packageRevisionId,
      packageGeneration: generation,
    })
    const updatedAt = new Date().toISOString()
    const result = {
      schemaVersion: RECORD_SCHEMA_VERSION,
      operation: OPERATION,
      presentationId,
      idempotencyKey,
      requestHash,
      generation,
      packageRevisionId: head.packageRevisionId,
      operationIds: journal.operations.map((item) => item.operationId),
      projection: canonicalAfter,
      sourceMap: successorSourceMap,
      journal,
      ...(trustedImportMetadata === undefined ? {} : { trustedImportMetadata }),
      // This state is server-owned and deliberately not a validated package outcome.
      state: 'pending-edited-export',
    }
    await store.commitProjectionSave({
      expectedHead: head,
      expectedStoreGeneration: state.generation,
      expectedFencingEpoch: store.fencingEpoch,
      result,
      compatibility,
      updatedAt,
    })
    retainPublishedSaveReceipts(store, [canonicalBefore, canonicalAfter])
    // Bind the derivation receipt to the exact raw predecessor admitted above.
    // Import projections may contain stripped metadata; canonicalBefore alone
    // is not the dependency envelope the next authoritative read will inspect.
    recordVerifiedJournal({
        presentationId,
        generation,
        packageRevisionId: head.packageRevisionId,
        matrixAuthorityEpoch: state.matrixAuthorityEpoch,
        previousProjection: authority.projection,
        currentProjection: canonicalAfter,
        previousSourceMap: sourceMap,
        journal,
        operationIds: result.operationIds,
      })
    return {
      ok: true,
      packageBacked: true,
      idempotent: false,
      generation,
      aggregateHead: store.getPresentationHead(presentationId),
      projection: canonicalAfter,
      projectionHash,
      responsePresentation: responsePublication(
        canonicalAfter, store.getPresentationHead(presentationId), updatedAt
      ),
    }
  })
}

async function getPackageGeneration(presentationId) {
  const store = await getReadablePackageStore()
  const head = store.getPresentationHead(presentationId)
  return head?.generation ?? null
}

module.exports = { getPackageGeneration, savePackageProjection }
