const { isDeepStrictEqual } = require('node:util')
const { clone, sealPublication, isSealedPublication } = require('./publication-snapshot')
const { canonicalSaveSnapshot } = require('../canonical-snapshot')
const { hashRecord, RECORD_SCHEMA_VERSION } = require('./schemas')
const { validateMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { validateTrustedImportMetadata } = require('../trusted-import-metadata')
const { MUTATION_OPERATIONS } = require('../mutation-operation-scope')
const { mergeCompatibilityPresentation } = require('../compatibility-view')

// Only this closed transaction can issue this proof; never accept a callback.
const ownedSuccessors = new WeakSet()
const capturedInputs = new WeakMap()
const OPERATION = MUTATION_OPERATIONS.PROJECTION_SAVE
function fail(code) { throw Object.assign(new Error(code), { code }) }

function captureProjectionSave(params) {
  // Canonical admission owns and seals the projection; all other caller graphs
  // must be detached before entering the serialization queue.
  const projection = canonicalSaveSnapshot(params.result.projection)
  const { projection: _projection, ...record } = params.result
  const { pptxSemantic: _semantic, ...metadata } = params.compatibility
  const captured = structuredClone({
    expectedHead: params.expectedHead,
    expectedStoreGeneration: params.expectedStoreGeneration,
    expectedFencingEpoch: params.expectedFencingEpoch,
    record, metadata, updatedAt: params.updatedAt,
  })
  captured.result = { ...captured.record, projection }
  // Use the existing publication-metadata policy, not a second field allowlist.
  // All editable root fields (including future ones) come from admission.
  captured.compatibility = mergeCompatibilityPresentation(captured.metadata, projection)
  const token = Object.freeze({})
  capturedInputs.set(token, captured)
  return token
}

function commitOwnedProjectionSave(current, token, fencingEpoch) {
  const input = capturedInputs.get(token)
  if (!input) throw new TypeError('Expected captured projection save')
  const { expectedHead, result, compatibility, updatedAt } = input
  if (input.expectedFencingEpoch !== fencingEpoch) fail('STALE_GENERATION')
  if (result.operation !== OPERATION || result.presentationId !== expectedHead.presentationId ||
      result.packageRevisionId !== expectedHead.packageRevisionId ||
      result.generation !== expectedHead.generation + 1) fail('INVALID_PROJECTION_SAVE')
  const head = current.heads.find((item) => item.presentationId === expectedHead.presentationId)
  // Narrow internal replay envelope: exact captured result equality only.
  // generation-safe-save remains authoritative for request identity, canonical
  // equivalent retries and legacy projection-save records before calling here.
  // Idempotency and head fences are evaluated in the same serialization slot.
  const prior = current.mutationResults.find((item) =>
    item.operation === OPERATION && item.presentationId === result.presentationId &&
    item.idempotencyKey === result.idempotencyKey)
  if (prior) {
    if (!isDeepStrictEqual(prior, result)) fail('IDEMPOTENCY_KEY_CONFLICT')
    if (!head || prior.generation !== head.generation ||
        prior.packageRevisionId !== head.packageRevisionId) fail('STALE_GENERATION')
    return { idempotent: true }
  }
  if (input.expectedStoreGeneration !== current.generation ||
      !head || !isDeepStrictEqual(head, expectedHead)) fail('STALE_GENERATION')
  if (head.matrixAuthorityEpoch !== current.matrixAuthorityEpoch ||
      !validateMatrixAuthoritySubjects(head.matrixAuthoritySubjects, undefined,
        current.matrixAuthorityEpoch).authorized) fail('STALE_MATRIX_AUTHORITY')
  const base = isSealedPublication(current) ? current : sealPublication(clone(current))
  const nextHead = {
    ...base.heads.find((item) => item.presentationId === result.presentationId),
    generation: result.generation,
    projectionRevisionId: hashRecord(result.projection),
    sourceMapRevisionId: hashRecord(result.sourceMap),
    journalRevisionId: result.journal.journalHash,
    pendingJournalHash: result.journal.journalHash,
    predecessorId: hashRecord(expectedHead), fencingEpoch,
    matrixAuthorityEpoch: base.matrixAuthorityEpoch,
  }
  const trusted = result.trustedImportMetadata === undefined ? undefined :
    validateTrustedImportMetadata(result.trustedImportMetadata, nextHead.originalRevisionId)
  const writeInput = {
    operation: 'upsert', presentationId: result.presentationId, generation: result.generation,
    ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
    ...(trusted === undefined ? {} : { trustedImportMetadata: trusted }),
    presentation: { ...compatibility, id: result.presentationId, pptxAggregateHead: nextHead },
  }
  const write = { schemaVersion: RECORD_SCHEMA_VERSION,
    id: `compatibility-${hashRecord(writeInput)}`, ...writeInput }
  const next = {
    ...base, generation: base.generation + 1, fencingEpoch,
    heads: base.heads.map((item) => item.presentationId === result.presentationId ? nextHead : item),
    mutationResults: [...base.mutationResults, result],
    compatibilityOutbox: base.compatibilityOutbox.some((item) => item.id === write.id) ?
      base.compatibilityOutbox : [...base.compatibilityOutbox, write],
  }
  sealPublication(next)
  if (isSealedPublication(next)) ownedSuccessors.add(next)
  return { next, idempotent: false }
}

function isOwnedProjectionSave(state) { return ownedSuccessors.has(state) }
module.exports = { captureProjectionSave, commitOwnedProjectionSave, isOwnedProjectionSave }
