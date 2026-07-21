const { buildOpcInventory } = require('./package-store/opc-inventory')
const { SCHEMA_VERSION, hashRecord, validateRevision } = require('./package-store/schemas')
const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const { deriveCanonicalPlainTextJournal } = require('./canonical-plain-text-journal')
const { rebindSourceMap } = require('./source-map')
const { securityPreflight } = require('./export-security-preflight')
const { compilePatchPlan } = require('./transactional-patch-planner')
const { resolvePrimitiveAdapter } = require('./primitive-adapter-registry')
const { runLayeredValidators } = require('./transactional-export-validators')
const { queueCompatibilityUpsert } = require('./compatibility-outbox')
const { createMatrixAuthoritySubjects, validateMatrixAuthoritySubjects } = require('./canonical-feature-matrix')
const { canonicalReasonCodes, reasonCodeSubject } = require('./reason-code-contract')
const { isValidIdempotencyKey } = require('./request-limits')
const { MUTATION_OPERATIONS } = require('./mutation-operation-scope')

const OPERATION = MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT
const exportFlights = new WeakMap()
const presentationExportLocks = new WeakMap()

function frozen(value) { return Object.freeze(value) }
function reasoned(status, reasonCode, extra = {}) {
  const reasonCodes = canonicalReasonCodes([reasonCode])
  return frozen({ ok: false, status, blockReason: reasonCodes[0], reasonCode: reasonCodes[0],
    reasonCodes, reasonCodeSubject: reasonCodeSubject(), ...extra })
}
function blocked(reasonCode) { return reasoned(422, reasonCode) }
function conflict(currentGeneration) {
  return reasoned(409, 'STALE_GENERATION', { conflict: frozen({ type: 'STALE_GENERATION', currentGeneration }) })
}
function queueCompatibilityProjection(next, presentation, head, updatedAt) {
  if (!presentation) return
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
function headFor(state, presentationId) { return state.heads.find((head) => head.presentationId === presentationId) }
function revisionFor(state, id) { return state.revisions.find((revision) => revision.id === id) }
function assertTargetHeadUnchanged(current, expected, matrixAuthorityEpoch) {
  const same = current && expected &&
    current.generation === expected.generation &&
    current.packageRevisionId === expected.packageRevisionId &&
    current.projectionRevisionId === expected.projectionRevisionId &&
    current.sourceMapRevisionId === expected.sourceMapRevisionId &&
    current.journalRevisionId === expected.journalRevisionId &&
    current.pendingJournalHash === expected.pendingJournalHash &&
    current.matrixAuthorityEpoch === expected.matrixAuthorityEpoch &&
    current.matrixAuthorityEpoch === matrixAuthorityEpoch &&
    hashRecord(current.matrixAuthoritySubjects || null) ===
      hashRecord(expected.matrixAuthoritySubjects || null)
  if (!same) throw Object.assign(new Error('Package head changed'), { code: 'STALE_GENERATION' })
}
function keyFor(operation) { return `${operation.slideId}:${operation.elementId}:${operation.sourceRef.partUri}:${operation.sourceRef.nativeId}` }
function requestHash(request) {
  return hashRecord({ operation: OPERATION, presentationId: request.presentationId, expectedGeneration: request.expectedGeneration,
    baseRevisionId: request.baseRevisionId || null, after: request.after, textTransports: request.textTransports || {},
    pendingEdit: request.pendingEdit === true, budgets: request.budgets || {},
    requireOfficeCli: request.requireOfficeCli === true, policy: request.policy || null })
}
function assertClosure(before, after, touchedParts) {
  const left = new Map(before.parts.map((part) => [part.path, part.sha256]))
  const right = new Map(after.parts.map((part) => [part.path, part.sha256]))
  if (left.size !== right.size || [...left.keys()].some((part) => !right.has(part))) throw new Error('OPC inventory changed outside the declared transaction')
  for (const [part, hash] of left) if (!touchedParts.has(part) && right.get(part) !== hash) throw new Error(`Untouched OPC part changed: ${part}`)
}
function isLegacyValidatedResult(result) {
  return result.operation === undefined &&
    result.state === 'committed' &&
    result.projection && result.sourceMap && result.journal &&
    Array.isArray(result.operationIds)
}
function idempotencyResult(state, request, hash) {
  const head = headFor(state, request.presentationId)
  const prior = state.mutationResults.find((item) =>
    (item.operation === OPERATION || isLegacyValidatedResult(item)) &&
    item.presentationId === request.presentationId &&
    item.idempotencyKey === request.idempotencyKey)
  if (!prior) return null
  const legacyReplay = isLegacyValidatedResult(prior) && prior.requestIdentity &&
    prior.requestIdentity.expectedGeneration === request.expectedGeneration &&
    prior.requestIdentity.baseRevisionId === (request.baseRevisionId || null) &&
    prior.requestIdentity.snapshotHash === hashRecord(request.after)
  const currentBinding = head && prior.packageRevisionId === head.packageRevisionId &&
    prior.generation === head.generation
  if (!currentBinding && head && request.expectedGeneration !== head.generation) {
    return conflict(head.generation)
  }
  const sameRequest = prior.requestHash === hash || legacyReplay
  if (!sameRequest) return reasoned(409, 'IDEMPOTENCY_KEY_CONFLICT')
  if (!currentBinding) return conflict(head?.generation || 1)
  return prior
}
async function applyPlan(bytes, plan, dependencies) {
  let output = bytes; const sourceHashes = {}
  for (const operation of plan.operations) {
    const key = keyFor(operation)
    const patched = sourceHashes[key] ? { ...operation, sourceRef: { ...operation.sourceRef, sourceHash: sourceHashes[key] } } : operation
    const adapter = resolvePrimitiveAdapter(patched.adapterId, dependencies)
    if (!adapter) return blocked('ADAPTER_DISPATCH_UNAVAILABLE')
    const result = await adapter.apply(output, patched)
    if (!Buffer.isBuffer(result?.bytes) || !/^[a-f0-9]{64}$/u.test(result.sourceHash || '')) throw new Error('Native adapter returned an invalid patch result')
    output = result.bytes; sourceHashes[key] = result.sourceHash
  }
  return { output, sourceHashes }
}
async function commitCandidateBlob(store, bytes) {
  const staged = await store.stageBlob(bytes)
  const candidateId = hashRecord({ sha256: staged.sha256, stagePath: staged.stagePath })
  await store.mutate((next) => {
    next.candidateBlobs.push({
      schemaVersion: SCHEMA_VERSION,
      id: candidateId,
      sha256: staged.sha256,
      byteLength: staged.byteLength,
      createdAt: new Date().toISOString(),
    })
  })
  try {
    const blob = await store.blobs.commit(staged)
    return { ...blob, candidateId }
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error
    return { ...(await store.blobs.commit(staged)), candidateId }
  }
}
async function executeLocked(dependencies, request) {
  const { store, loadSourceMap, loadCanonicalProjection, validators = {}, nativeTextAdapter, nativePrimitiveAdapter } = dependencies
  if (!isValidIdempotencyKey(request?.idempotencyKey)) return reasoned(400, 'INVALID_IDEMPOTENCY_KEY')
  const initial = store.getState(); const head = headFor(initial, request.presentationId)
  if (!head) return reasoned(404, 'PRESENTATION_PACKAGE_HEAD_MISSING')
  const hash = requestHash(request); const prior = idempotencyResult(initial, request, hash)
  if (prior) {
    if (prior.ok === false) return prior
    const revision = revisionFor(initial, prior.packageRevisionId)
    return frozen({ ok: true, idempotent: true, generation: prior.generation, revisionId: prior.packageRevisionId, bytes: await store.readBlob(revision.blobSha256) })
  }
  if (head.generation !== request.expectedGeneration) return conflict(head.generation)
  if (!validateMatrixAuthoritySubjects(
    head.matrixAuthoritySubjects, undefined, initial.matrixAuthorityEpoch
  ).authorized || head.matrixAuthorityEpoch !== initial.matrixAuthorityEpoch) {
    return blocked('STALE_MATRIX_AUTHORITY')
  }
  if (request.baseRevisionId !== undefined && request.baseRevisionId !== head.packageRevisionId) {
    return reasoned(409, 'BASE_REVISION_MISMATCH', {
      conflict: frozen({
        type: 'BASE_REVISION_MISMATCH',
        currentGeneration: head.generation,
        currentRevisionId: head.packageRevisionId,
      }),
    })
  }
  const sourceMap = await loadSourceMap({ presentationId: request.presentationId, revisionId: head.packageRevisionId })
  const before = await loadCanonicalProjection({ presentationId: request.presentationId, revisionId: head.packageRevisionId, generation: head.generation })
  if (!before || before.id !== request.presentationId) return blocked('CANONICAL_PROJECTION_UNAVAILABLE')
  let journal
  const journalOptions = {
    baseRevisionId: head.packageRevisionId,
    sourceMap,
    requestIdentity: hash,
    matrixAuthorityEpoch: initial.matrixAuthorityEpoch,
  }
  if (request.textTransports !== undefined) journalOptions.textTransports = request.textTransports
  if (request.budgets !== undefined) journalOptions.budgets = request.budgets
  try { journal = deriveCanonicalPlainTextJournal(before, request.after, journalOptions) } catch { return blocked('CANONICAL_TEXT_JOURNAL_INVALID') }
  const current = revisionFor(initial, head.packageRevisionId); const bytes = await store.readBlob(current.blobSha256)
  if (!journal.operations.length) {
    if (request.pendingEdit === true) return blocked('CANONICAL_TEXT_JOURNAL_INVALID')
    const result = { schemaVersion: SCHEMA_VERSION, operation: OPERATION, presentationId: request.presentationId, idempotencyKey: request.idempotencyKey, requestHash: hash, requestIdentity: { expectedGeneration: request.expectedGeneration, baseRevisionId: request.baseRevisionId || null, snapshotHash: hashRecord(request.after) }, generation: head.generation, packageRevisionId: head.packageRevisionId, operationIds: [], projection: before, sourceMap, journal, state: 'committed' }
    await store.mutate((next) => {
      const nextHead = headFor(next, request.presentationId)
      assertTargetHeadUnchanged(nextHead, head, initial.matrixAuthorityEpoch)
      if (request.pendingEdit !== true && request.pendingJournalHash &&
          nextHead.pendingJournalHash === request.pendingJournalHash) {
        delete nextHead.pendingJournalHash
        if (nextHead.packageRevisionId === nextHead.originalRevisionId) {
          nextHead.journalRevisionId = null
        }
      }
      next.mutationResults.push(result)
      queueCompatibilityProjection(next, request.compatibilityPresentation, nextHead)
    })
    return frozen({ ok: true, idempotent: false, noOp: true, generation: head.generation, revisionId: head.packageRevisionId, bytes })
  }
  if (sourceMap?.presentationId !== request.presentationId || sourceMap?.revisionId !== head.packageRevisionId || sourceMap?.packageGeneration !== head.generation) return blocked('SOURCE_MAP_MISMATCH')
  const security = await securityPreflight(bytes); if (!security.ok) return blocked(security.blockReason)
  const plan = compilePatchPlan(journal, {
    matrixAuthorityEpoch: initial.matrixAuthorityEpoch,
  }); if (!plan.ok) return blocked(plan.reasonCode)
  if (request.cancelled) return reasoned(409, 'CANCELLED', { cancellation: 'cancelled' })
  const applied = await applyPlan(bytes, plan, { nativeTextAdapter, nativePrimitiveAdapter }); if (applied.ok === false) return applied
  const [oldInventory, inventory] = await Promise.all([buildOpcInventory(bytes), buildOpcInventory(applied.output)])
  assertClosure(oldInventory, inventory, new Set(plan.touchedParts))
  await runLayeredValidators({
    beforeBytes: bytes,
    afterBytes: applied.output,
    touchedParts: plan.touchedParts,
    expectedProjection: request.after,
    journal,
    sourceMap,
    presentationId: request.presentationId,
    revisionId: head.packageRevisionId,
    packageGeneration: head.generation,
    requireOfficeCli: request.requireOfficeCli === true,
  }, validators)
  const candidate = await commitCandidateBlob(store, applied.output)
  const { candidateId, ...blob } = candidate
  const ordinal = current.ordinal + 1
  const revision = validateRevision({ schemaVersion: SCHEMA_VERSION, id: `r${ordinal}-${blob.sha256}`, ordinal, blobSha256: blob.sha256, manifestHash: inventory.manifestHash, createdAt: new Date().toISOString() })
  const projection = canonicalEditableSnapshot(request.after, request.budgets); const generation = head.generation + 1
  const touchedHashes = Object.fromEntries(plan.operations.map((operation) => [
    `${operation.slideId}:${operation.elementId}`, applied.sourceHashes[keyFor(operation)],
  ]))
  const successorMap = rebindSourceMap(sourceMap, { presentationId: request.presentationId, revisionId: revision.id, packageGeneration: generation }, touchedHashes)
  const result = { schemaVersion: SCHEMA_VERSION, operation: OPERATION, presentationId: request.presentationId, idempotencyKey: request.idempotencyKey, requestHash: hash, requestIdentity: { expectedGeneration: request.expectedGeneration, baseRevisionId: request.baseRevisionId || null, snapshotHash: hashRecord(request.after) }, generation, packageRevisionId: revision.id, operationIds: journal.operations.map((operation) => operation.operationId), projection, sourceMap: successorMap, journal, state: 'committed' }
  const updatedAt = new Date().toISOString()
  await store.mutate((next) => {
    const nextHead = headFor(next, request.presentationId)
    assertTargetHeadUnchanged(nextHead, head, initial.matrixAuthorityEpoch)
    next.candidateBlobs = next.candidateBlobs.filter((candidate) => candidate.id !== candidateId)
    next.blobs.push(blob); next.revisions.push(revision); next.owners.push({ schemaVersion: SCHEMA_VERSION, revisionId: revision.id, ownerType: 'presentation', ownerId: request.presentationId })
    next.heads = next.heads.map((item) => {
      if (item.presentationId !== request.presentationId) return item
      const successor = {
        ...item,
        packageRevisionId: revision.id,
        projectionRevisionId: hashRecord(projection),
        sourceMapRevisionId: hashRecord(successorMap),
        journalRevisionId: journal.journalHash,
        matrixAuthorityEpoch: next.matrixAuthorityEpoch,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, next.matrixAuthorityEpoch),
        generation,
        predecessorId: hashRecord(head),
        fencingEpoch: store.fencingEpoch,
      }
      delete successor.pendingJournalHash
      return successor
    })
    next.mutationResults.push(result)
    queueCompatibilityProjection(
      next,
      request.compatibilityPresentation,
      next.heads.find((item) => item.presentationId === request.presentationId),
      updatedAt
    )
  }, { ...request.faults })
  return frozen({ ok: true, idempotent: false, generation, revisionId: revision.id, bytes: applied.output })
}
async function executeWithWriter(dependencies, request) {
  const { store } = dependencies
  const owned = typeof store.ownsWriter === 'function' && await store.ownsWriter()
  if (!owned) await store.acquireWriter()
  try {
    return await executeLocked(dependencies, request)
  } catch (error) {
    if (error?.code === 'STALE_GENERATION') {
      const state = store.getState()
      const prior = idempotencyResult(state, request, requestHash(request))
      if (prior) {
        if (prior.ok === false) return prior
        const revision = revisionFor(state, prior.packageRevisionId)
        if (revision) {
          return frozen({ ok: true, idempotent: true, generation: prior.generation,
            revisionId: prior.packageRevisionId, bytes: await store.readBlob(revision.blobSha256) })
        }
      }
      const currentHead = headFor(state, request.presentationId)
      return currentHead
        ? conflict(currentHead.generation)
        : reasoned(404, 'PRESENTATION_PACKAGE_HEAD_MISSING')
    }
    throw error
  } finally {
    if (!owned) await store.releaseWriter()
  }
}
function exportFlightKey(request) {
  try {
    return hashRecord({
      presentationId: request?.presentationId,
      idempotencyKey: request?.idempotencyKey,
      requestHash: requestHash(request),
      cancelled: request?.cancelled === true,
    })
  } catch { return null }
}
async function executeWithPresentationLock(dependencies, request) {
  const { store } = dependencies
  let locks = presentationExportLocks.get(store)
  if (!locks) {
    locks = new Map()
    presentationExportLocks.set(store, locks)
  }
  const presentationId = request.presentationId
  const previous = locks.get(presentationId)
  let release
  const current = new Promise((resolve) => { release = resolve })
  locks.set(presentationId, current)
  try {
    if (previous) await previous
    return await executeWithWriter(dependencies, request)
  } finally {
    release()
    if (locks.get(presentationId) === current) locks.delete(presentationId)
    if (!locks.size) presentationExportLocks.delete(store)
  }
}

async function executeMutation(dependencies, request) {
  const { store } = dependencies
  if (!isValidIdempotencyKey(request?.idempotencyKey) || !store ||
      typeof store !== 'object') return executeWithWriter(dependencies, request)
  const key = exportFlightKey(request)
  if (!key) return executeWithWriter(dependencies, request)
  let flights = exportFlights.get(store)
  if (!flights) { flights = new Map(); exportFlights.set(store, flights) }
  const prior = flights.get(key)
  if (prior) {
    const result = await prior
    return result.ok ? frozen({ ...result, idempotent: true }) : result
  }
  const flight = executeWithPresentationLock(dependencies, request)
  flights.set(key, flight)
  try { return await flight } finally {
    if (flights.get(key) === flight) flights.delete(key)
    if (!flights.size) exportFlights.delete(store)
  }
}
module.exports = { assertClosure, executeMutation }
