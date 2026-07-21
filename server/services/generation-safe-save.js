const {
  getReadablePackageStore,
  withPackageStore,
} = require('./pptx-import/package-store-runtime')
const { canonicalEditableSnapshot, deriveMutationJournal } = require(
  './pptx-import/mutation-journal'
)
const { hashRecord, SCHEMA_VERSION } = require('./pptx-import/package-store/schemas')
const { rebindSourceMap } = require('./pptx-import/source-map')
const { queueCompatibilityUpsert } = require('./pptx-import/compatibility-outbox')
const { validateMatrixAuthoritySubjects } = require('./pptx-import/canonical-feature-matrix')
const { canonicalReasonCodes, reasonCodeSubject } = require('./pptx-import/reason-code-contract')
const { isValidIdempotencyKey } = require('./pptx-import/request-limits')
const { MUTATION_OPERATIONS } = require('./pptx-import/mutation-operation-scope')

const OPERATION = MUTATION_OPERATIONS.PROJECTION_SAVE

function currentHead(state, presentationId) {
  const head = state.heads.find((item) => item.presentationId === presentationId)
  return head ? structuredClone(head) : null
}
function currentAuthority(state, head) {
  return [...state.mutationResults].reverse().find((result) =>
    result.presentationId === head.presentationId && result.packageRevisionId === head.packageRevisionId &&
    result.sourceMap && result.projection
  ) || null
}

function isLegacyProjectionSaveResult(result) {
  return result?.operation === undefined &&
    result.state === 'pending-edited-export' &&
    result.projection && result.sourceMap && result.journal &&
    Array.isArray(result.operationIds)
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

function queueCompatibilityProjection(next, presentation, head, updatedAt) {
  queueCompatibilityUpsert(next, {
    presentationId: head.presentationId,
    generation: head.generation,
    ...(updatedAt ? { updatedAt } : {}),
    presentation: {
      ...presentation,
      id: head.presentationId,
      pptxAggregateHead: structuredClone(head),
    },
  })
}

async function savePackageProjection({
  presentationId, expectedGeneration, baseRevisionId, idempotencyKey, after, loadStored,
}) {
  return withPackageStore(async (store) => {
    const state = store.getState()
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
    if (baseRevisionId !== undefined &&
        (typeof baseRevisionId !== 'string' || !baseRevisionId.trim() || baseRevisionId.length > 200)) {
      return denied(400, 'INVALID_BASE_REVISION')
    }
    const authority = currentAuthority(state, head)
    const stored = authority?.projection || await loadStored()
    if (!stored) return denied(404, 'NOT_FOUND')
    const canonicalBefore = canonicalEditableSnapshot(stored)
    const canonicalAfter = canonicalEditableSnapshot({ ...stored, ...after, id: presentationId })
    const compatibility = compatibilityPresentation(stored, canonicalAfter, presentationId)
    const sourceMap = authority?.sourceMap
    // A normal save only publishes the canonical projection and pending journal.
    // Only the validated edited-export workflow may materialize a successor package revision.
    const requestHash = hashRecord({ operation: OPERATION, presentationId, expectedGeneration, baseRevisionId: baseRevisionId || null, after })
    const prior = state.mutationResults.find((item) =>
      (item.operation === OPERATION || isLegacyProjectionSaveResult(item)) &&
      item.presentationId === presentationId && item.idempotencyKey === idempotencyKey)
    if (prior) {
      const replay = prior.requestIdentity
        ? prior.requestIdentity.expectedGeneration === expectedGeneration &&
          prior.requestIdentity.baseRevisionId === (baseRevisionId || null) &&
          prior.requestIdentity.snapshotHash === hashRecord(canonicalAfter)
        : isLegacyProjectionSaveResult(prior) &&
          expectedGeneration === prior.generation - 1 &&
          (baseRevisionId === undefined || baseRevisionId === prior.packageRevisionId) &&
          (!prior.journal?.baseRevisionId || prior.journal.baseRevisionId === prior.packageRevisionId) &&
          hashRecord(canonicalAfter) === hashRecord(prior.projection)
      const sameRequest = prior.requestHash === requestHash || replay
      if (!sameRequest) return denied(409, 'IDEMPOTENCY_KEY_CONFLICT')
      if (prior.packageRevisionId !== head.packageRevisionId || prior.generation !== head.generation) {
        return denied(409, 'STALE_GENERATION', { currentGeneration: head.generation })
      }
      return { ok: true, packageBacked: true, idempotent: true, generation: prior.generation,
        aggregateHead: currentHead(store.getState(), presentationId),
        projection: prior.projection, projectionHash: hashRecord(prior.projection) }
    }
    if (head.generation !== expectedGeneration) {
      return denied(409, 'STALE_GENERATION', { currentGeneration: head.generation })
    }
    if (head.matrixAuthorityEpoch !== state.matrixAuthorityEpoch ||
      !validateMatrixAuthoritySubjects(
        head.matrixAuthoritySubjects, undefined, state.matrixAuthorityEpoch
      ).authorized) {
      return denied(422, 'STALE_MATRIX_AUTHORITY')
    }
    if (baseRevisionId !== undefined && baseRevisionId !== head.packageRevisionId) {
      return denied(409, 'BASE_REVISION_MISMATCH', {
        currentGeneration: head.generation,
        currentRevisionId: head.packageRevisionId,
      })
    }
    if (!sourceMap) return denied(422, 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE')
    const journal = deriveMutationJournal(canonicalBefore, canonicalAfter, {
      baseRevisionId: head.packageRevisionId,
      sourceMap,
      matrixAuthorityEpoch: state.matrixAuthorityEpoch,
    })
    const generation = head.generation + 1
    const successorSourceMap = rebindSourceMap(sourceMap, {
      presentationId, revisionId: head.packageRevisionId, packageGeneration: generation,
    })
    const updatedAt = new Date().toISOString()
    const result = {
      schemaVersion: SCHEMA_VERSION,
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
      // This state is server-owned and deliberately not a validated package outcome.
      state: 'pending-edited-export',
    }
    await store.mutate((next) => {
      const nextHead = next.heads.find((item) => item.presentationId === presentationId)
      if (!nextHead || nextHead.generation !== expectedGeneration) {
        const error = new Error('Package head changed')
        error.code = 'STALE_GENERATION'
        throw error
      }
      nextHead.generation = generation
      nextHead.projectionRevisionId = hashRecord(canonicalAfter)
      nextHead.sourceMapRevisionId = hashRecord(successorSourceMap)
      nextHead.journalRevisionId = journal.journalHash
      nextHead.pendingJournalHash = journal.journalHash
      nextHead.predecessorId = hashRecord(head)
      nextHead.fencingEpoch = store.fencingEpoch
      nextHead.matrixAuthorityEpoch = next.matrixAuthorityEpoch
      next.mutationResults.push(result)
      queueCompatibilityProjection(next, compatibility, nextHead, updatedAt)
    })
    return {
      ok: true, packageBacked: true, idempotent: false,
      generation, aggregateHead: currentHead(store.getState(), presentationId), projection: canonicalAfter,
      projectionHash: hashRecord(canonicalAfter),
    }
  })
}

async function getPackageGeneration(presentationId) {
  const store = await getReadablePackageStore()
  const head = store.getState().heads.find((item) => item.presentationId === presentationId)
  return head?.generation ?? null
}

module.exports = { getPackageGeneration, savePackageProjection }
