const crypto = require('node:crypto')
const { isDeepStrictEqual, types } = require('node:util')
const { isCheckedImmutableSemanticValue } = require('revealjs-shared/src/pptx-semantic-records.js')
const { canonicalSaveSnapshot, reusableCanonicalSaveSnapshot } = require('./canonical-snapshot')
const { getReadablePackageStore } = require('./package-store-runtime')
const { hashCanonical } = require('./evidence/canonical-hash')
const {
  canonicalJson,
  hashRecord,
} = require('./package-store/schemas')

// Admission is stronger than serialization: raw authority must not hide fields
// that canonical JSON or structuredClone would silently omit. Cache only the
// recursive plain-data immutability proof, never a second serialization receipt.
const immutableCanonicalData = new WeakSet()
function isImmutableCanonicalData(value, visiting = new Set()) {
  const invalid = () => { throw snapshotError('INVALID_AUTHORITY_DATA', 'Authority requires plain own enumerable data') }
  if (value === null || value === undefined) return true
  if (typeof value !== 'object') {
    if (!['string', 'boolean', 'number'].includes(typeof value) ||
        (typeof value === 'number' && !Number.isFinite(value))) invalid()
    return true
  }
  if (types.isProxy(value)) invalid()
  if (immutableCanonicalData.has(value)) return true
  // Checked clones own dense, finite JSON-only plain graphs, recursively frozen
  // at allocation. This is a data/ownership proof, NOT semantic admission (a
  // broadly certified document alone does not establish these invariants).
  if (isCheckedImmutableSemanticValue(value)) {
    immutableCanonicalData.add(value)
    return true
  }
  if (visiting.has(value)) invalid()
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (array ? prototype !== Array.prototype :
      prototype !== Object.prototype && prototype !== null) invalid()
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (array) {
    if (Reflect.ownKeys(descriptors).length !== descriptors.length.value + 1) invalid()
    for (let index = 0; index < descriptors.length.value; index++) {
      if (!Object.hasOwn(descriptors, index)) invalid()
    }
  }
  visiting.add(value)
  let immutable = Object.isFrozen(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key]
    if (typeof key !== 'string' || !Object.hasOwn(descriptor, 'value') ||
        (!descriptor.enumerable && !(array && key === 'length'))) invalid()
    if (!isImmutableCanonicalData(descriptor.value, visiting)) immutable = false
  }
  visiting.delete(value)
  if (immutable) immutableCanonicalData.add(value)
  return immutable
}
const { createSourceMap } = require('./source-map')
const { deriveMutationJournal } = require('./mutation-journal')
const { validateMatrixAuthoritySubjects } = require('./canonical-feature-matrix')
const { MUTATION_OPERATIONS: OPERATIONS } = require('./mutation-operation-scope')
const {
  isNoOpExportReceipt,
  hasValidCommittedJournal,
} = require('./editor-projection-journal-authority')
const {
  resolveImmutableOriginalRevisionBytes,
  resolvePackageRevisionBytes,
} = require('./package-revision-resolver')

// An index is not proof. Keep detached, sealed full dependencies, not a second
// giant canonical string. Raw queries must match every dependency exactly.
const verifiedJournalCache = new Map()
const verifiedJournalIdentities = new WeakMap()
function journalScope({ presentationId, generation, packageRevisionId, matrixAuthorityEpoch }) {
  return JSON.stringify([presentationId, generation, packageRevisionId, matrixAuthorityEpoch])
}
function ownedDependency(value) {
  return isImmutableCanonicalData(value) ? value : sealAuthority(structuredClone(value))
}
function matchesVerifiedJournal(scope, dependencies) {
  const { previousProjection, currentProjection } = dependencies
  const identities = previousProjection && verifiedJournalIdentities.get(previousProjection)
  const receipt = identities?.get(currentProjection)
  if (receipt?.scope === scope && Object.keys(dependencies).every(
    (key) => receipt.dependencies[key] === dependencies[key])) return true
  const retained = verifiedJournalCache.get(scope)
  if (!retained || !isDeepStrictEqual(retained, dependencies)) return false
  // Promote only fully immutable tuples; mutable caller identities never prove content.
  if (Object.values(dependencies).every((value) => isImmutableCanonicalData(value))) {
    let afters = verifiedJournalIdentities.get(previousProjection)
    if (!afters) verifiedJournalIdentities.set(previousProjection, afters = new WeakMap())
    afters.set(currentProjection, { scope, dependencies: Object.freeze({ ...dependencies }) })
  }
  return true
}

// Mutable metadata identities are never authority receipts. Recheck the complete
// content/version envelope before sharing a private, recursively sealed copy.
// Durable publication clones lose canonical admission identities. Recover only
// the latest save's certified outputs, by complete deep equality.
// These are admission receipts, never a substitute for journal verification.
const publishedSaveReceipts = new WeakMap()
function retainPublishedSaveReceipts(store, snapshots) {
  publishedSaveReceipts.set(store, snapshots
    .filter((snapshot) => reusableCanonicalSaveSnapshot(snapshot))
    .map((snapshot) => ({ snapshot })))
}
function equivalentPublishedSaveSnapshot(store, projection, limits) {
  const candidates = publishedSaveReceipts.get(store)
  if (!candidates?.length) return null
  // This bounded latest-publication list is compared in full; serializing the
  // same projection again adds no authority beyond exact deep equality.
  return candidates.find((candidate) =>
    reusableCanonicalSaveSnapshot(candidate.snapshot, limits) &&
    isDeepStrictEqual(candidate.snapshot, projection))?.snapshot || null
}
const ownedStates = new WeakMap()
const ownedContexts = new WeakMap()
function sealAuthority(value) {
  if (!value || typeof value !== 'object' || immutableCanonicalData.has(value)) return value
  for (const child of Object.values(value)) sealAuthority(child)
  return Object.freeze(value)
}
function acquireOwnedAuthorityState(store, state, root) {
  const previous = ownedStates.get(store)
  // No canonical full-state walk on the published read path. Trust requires
  // recursive plain-data immutability of BOTH graphs, never shallow freeze,
  // generation, root hash, or mutable identity. Unowned callers keep exact proof.
  const immutableState = isImmutableCanonicalData(state)
  const immutableRoot = isImmutableCanonicalData(root)
  const immutable = immutableState && immutableRoot
  if (immutable && previous?.sourceState === state && previous.sourceRoot === root)
    return previous.state
  const envelope = immutable ? null : canonicalJson({ root, state })
  const version = immutable ? null : sha256(envelope)
  if (!immutable && previous?.version === version && previous.envelope === envelope)
    return previous.state
  // Immutable publication children already belong to the store. Copy only the
  // result shells that may receive a certified save receipt, not historical data.
  const copy = immutable
    ? { ...state, mutationResults: (state.mutationResults || []).map((result) => ({ ...result })) }
    : structuredClone(state)
  for (const result of copy.mutationResults || []) {
    if (!result.projection) continue
    const admitted = equivalentPublishedSaveSnapshot(store, result.projection)
    if (admitted) result.projection = admitted
  }
  const snapshot = sealAuthority(copy)
  ownedContexts.set(snapshot, new Map())
  ownedStates.set(store, {
    version, envelope, state: snapshot,
    sourceState: immutable ? state : null, sourceRoot: immutable ? root : null,
  })
  return snapshot
}

function recordVerifiedJournal({
  presentationId,
  generation,
  packageRevisionId,
  matrixAuthorityEpoch,
  previousProjection,
  currentProjection,
  previousSourceMap,
  journal,
  operationIds,
}) {
  if (!presentationId || !generation || !packageRevisionId || !matrixAuthorityEpoch) return
  const scope = journalScope({ presentationId, generation, packageRevisionId, matrixAuthorityEpoch })
  const dependencies = Object.freeze(Object.fromEntries(Object.entries({
    previousProjection, currentProjection, previousSourceMap, journal, operationIds,
  }).map(([key, value]) => [key, ownedDependency(value)])))
  verifiedJournalCache.set(scope, dependencies)
  let afters = verifiedJournalIdentities.get(dependencies.previousProjection)
  if (!afters) verifiedJournalIdentities.set(dependencies.previousProjection, afters = new WeakMap())
  afters.set(dependencies.currentProjection, { scope, dependencies })
  if (verifiedJournalCache.size > 1000) {
    const first = verifiedJournalCache.keys().next().value
    verifiedJournalCache.delete(first)
  }
}

function snapshotError(code, message) {
  return Object.assign(new Error(message), { code, status: 422 })
}

function isOwned(state, presentationId, revisionId) {
  return state.owners?.some(
    (owner) =>
      owner.ownerType === 'presentation' &&
      owner.ownerId === presentationId &&
      owner.revisionId === revisionId
  )
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value)
}

async function readPackageAuthoritySnapshot(presentationId, { store: providedStore } = {}) {
  if (typeof presentationId !== 'string' || !presentationId) {
    throw snapshotError('INVALID_PRESENTATION_ID', 'A presentation identifier is required')
  }
  const store = providedStore || (await getReadablePackageStore())
  const state = store.getState()
  const head = state.heads.find((item) => item.presentationId === presentationId)
  if (!head)
    throw snapshotError('PACKAGE_HEAD_UNAVAILABLE', 'Authoritative package head is unavailable')
  if (
    !isOwned(state, presentationId, head.originalRevisionId) ||
    !isOwned(state, presentationId, head.packageRevisionId)
  ) {
    throw snapshotError(
      'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      'Current package authority is unavailable'
    )
  }
  const revision = state.revisions.find((item) => item.id === head.originalRevisionId)
  if (!revision || !isSha256(revision.blobSha256)) {
    throw snapshotError(
      'IMMUTABLE_ORIGINAL_UNAVAILABLE',
      'Immutable original package revision is unavailable'
    )
  }
  let bytes
  try {
    bytes = await store.readBlob(revision.blobSha256)
  } catch {
    throw snapshotError(
      'IMMUTABLE_ORIGINAL_BLOB_UNAVAILABLE',
      'Immutable original package bytes are unavailable'
    )
  }
  const originalSha256 = sha256(bytes)
  if (originalSha256 !== revision.blobSha256) {
    throw snapshotError(
      'IMMUTABLE_ORIGINAL_CORRUPT',
      'Immutable original package hash verification failed'
    )
  }
  return {
    presentationId,
    packageRevisionId: head.packageRevisionId,
    packageHeadHash: hashCanonical(head),
    aggregateGeneration: head.generation,
    originalSha256,
    originalByteLength: bytes.length,
    originalBytes: bytes,
  }
}

function publicPackageAuthoritySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null
  return {
    schemaVersion: 1,
    presentationId: snapshot.presentationId,
    packageAuthority: {
      revisionId: snapshot.packageRevisionId,
      headHash: snapshot.packageHeadHash,
    },
    aggregateGeneration: snapshot.aggregateGeneration,
    original: {
      sha256: snapshot.originalSha256,
      byteLength: snapshot.originalByteLength,
    },
  }
}

function samePackageAuthority(left, right) {
  if (!left || !right) return false
  const leftAuthority = left.packageAuthority || left
  const rightAuthority = right.packageAuthority || right
  const leftRevision = leftAuthority.revisionId || leftAuthority.packageRevisionId
  const rightRevision = rightAuthority.revisionId || rightAuthority.packageRevisionId
  const leftHeadHash = leftAuthority.headHash || leftAuthority.packageHeadHash
  const rightHeadHash = rightAuthority.headHash || rightAuthority.packageHeadHash
  if (
    typeof left.presentationId !== 'string' ||
    !left.presentationId ||
    left.presentationId !== right.presentationId ||
    typeof leftRevision !== 'string' ||
    !leftRevision ||
    leftRevision !== rightRevision ||
    !isSha256(leftHeadHash) ||
    leftHeadHash !== rightHeadHash ||
    !Number.isSafeInteger(left.aggregateGeneration) ||
    left.aggregateGeneration < 1 ||
    left.aggregateGeneration !== right.aggregateGeneration
  )
    return false
  const leftOriginalSha = left.originalSha256 ?? left.original?.sha256
  const rightOriginalSha = right.originalSha256 ?? right.original?.sha256
  const leftOriginalLength = left.originalByteLength ?? left.original?.byteLength
  const rightOriginalLength = right.originalByteLength ?? right.original?.byteLength
  const originalCompared =
    leftOriginalSha !== undefined ||
    rightOriginalSha !== undefined ||
    leftOriginalLength !== undefined ||
    rightOriginalLength !== undefined
  return (
    !originalCompared ||
    (leftOriginalSha === rightOriginalSha && leftOriginalLength === rightOriginalLength)
  )
}

function editorResultAllowed(result) {
  return result.state === 'committed'
    ? [undefined, OPERATIONS.PACKAGE_IMPORT, OPERATIONS.VALIDATED_EDITED_EXPORT].includes(
        result.operation
      )
    : result.state === 'pending-edited-export' &&
        [undefined, OPERATIONS.PROJECTION_SAVE].includes(result.operation) &&
        Array.isArray(result.operationIds)
}

// Editor saves are authoritative projections, not qualified native package mutations.
function resolveEditorProjectionContext(state, presentationId) {
  const cache = ownedContexts.get(state)
  if (cache?.has(presentationId)) return cache.get(presentationId)
  const result = resolveUncachedEditorProjectionContext(state, presentationId)
  // Only a complete successful validation/rederivation authorizes reuse.
  if (cache && result.ok) cache.set(presentationId, sealAuthority(result))
  return result
}

function resolveUncachedEditorProjectionContext(state, presentationId) {
  const failed = (reasonCode = 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE') => ({
    ok: false,
    reasonCode,
  })
  const heads = state.heads.filter((item) => item.presentationId === presentationId)
  if (!heads.length) return failed('PRESENTATION_PACKAGE_HEAD_MISSING')
  if (heads.length !== 1) return failed()
  const head = heads[0]
  if (
    head.matrixAuthorityEpoch !== state.matrixAuthorityEpoch ||
    !validateMatrixAuthoritySubjects(
      head.matrixAuthoritySubjects,
      undefined,
      state.matrixAuthorityEpoch
    ).authorized
  )
    return failed('STALE_MATRIX_AUTHORITY')
  try {
    const scoped = state.mutationResults.filter(
      (result) =>
        result.presentationId === presentationId &&
        result.packageRevisionId === head.packageRevisionId &&
        result.projection &&
        result.sourceMap
    )
    const results = scoped.filter(editorResultAllowed)
    const validIdentity = (result) =>
      result.projection.id === presentationId &&
      result.sourceMap.presentationId === presentationId &&
      result.sourceMap.revisionId === head.packageRevisionId &&
      result.sourceMap.packageGeneration === result.generation &&
      Object.values(result.sourceMap.entries).every(
        (ref) =>
          ref.revisionId === head.packageRevisionId && ref.packageGeneration === result.generation
      ) &&
      hashRecord(createSourceMap(result.sourceMap)) === hashRecord(result.sourceMap)
    const pending = head.pendingJournalHash !== undefined
    const candidates = scoped.filter((result) => result.generation === head.generation)
    const receipts = !pending ? candidates.filter(isNoOpExportReceipt) : []
    let authorities = candidates.filter((result) => !receipts.includes(result))
    // Portable import may collapse historical generations. A reconciled pending
    // row is superseded only by the matching committed package authority.
    if (receipts.length && authorities.some((result) => result.state === 'committed')) {
      authorities = authorities.filter(
        (result) =>
          !(
            result.state === 'pending-edited-export' &&
            editorResultAllowed(result) &&
            validIdentity(result) &&
            hashRecord(result.projection) === head.projectionRevisionId &&
            hashRecord(result.sourceMap) === head.sourceMapRevisionId
          )
      )
    }
    if (authorities.length !== 1) return failed()
    const current = authorities[0]
    if (
      receipts.some(
        (result) =>
          !validIdentity(result) ||
          hashRecord(result.projection) !== head.projectionRevisionId ||
          hashRecord(result.sourceMap) !== head.sourceMapRevisionId ||
          !hasValidCommittedJournal(result, head.journalRevisionId)
      )
    )
      return failed()
    if (
      !editorResultAllowed(current) ||
      !validIdentity(current) ||
      (current.state !== (pending ? 'pending-edited-export' : 'committed') &&
        !(receipts.length && current.state === 'pending-edited-export')) ||
      hashRecord(current.projection) !== head.projectionRevisionId ||
      hashRecord(current.sourceMap) !== head.sourceMapRevisionId
    )
      return failed()
    if (pending || current.state === 'pending-edited-export') {
      if (
        (pending && head.journalRevisionId !== head.pendingJournalHash) ||
        current.journal?.baseRevisionId !== head.packageRevisionId ||
        (pending && current.journal.journalHash !== head.pendingJournalHash)
      )
        return failed()
      const anchors = results.filter(
        (result) =>
          result.state === 'committed' &&
          result.generation < head.generation &&
          validIdentity(result)
      )
      const previous = results.filter(
        (result) =>
          result.generation === head.generation - 1 &&
          validIdentity(result) &&
          !isNoOpExportReceipt(result)
      )
      if (!anchors.length || previous.length !== 1) return failed()
      // A historical editor journal is hash-bound, not a current native grant.
      // Restore may advance the live epoch without rewriting pending siblings.
      const journalEpoch = current.journal?.matrixAuthoritySubject?.evolutionEpoch
      if (
        !Number.isSafeInteger(journalEpoch) ||
        journalEpoch < 1 ||
        journalEpoch > state.matrixAuthorityEpoch
      )
        return failed()
      const scope = journalScope({
        presentationId: head.presentationId, generation: head.generation,
        packageRevisionId: head.packageRevisionId, matrixAuthorityEpoch: journalEpoch,
      })
      const dependencies = {
        previousProjection: previous[0].projection,
        currentProjection: current.projection,
        previousSourceMap: previous[0].sourceMap,
        journal: current.journal,
        operationIds: current.operationIds,
      }
      if (!matchesVerifiedJournal(scope, dependencies)) {
        // Re-admit BOTH persisted operands under the same save policy. Cold
        // publications have no private admission receipts, while a live save
        // may restore only its current projection's receipt. Never let that
        // asymmetric provenance select different validation/replay semantics.
        // Raw history remains hash-bound above; admission still charges raw
        // metadata and output budgets and does not rewrite the durable format.
        const before = canonicalSaveSnapshot(previous[0].projection)
        const after = canonicalSaveSnapshot(current.projection)
        const expected = deriveMutationJournal(before, after, {
          baseRevisionId: head.packageRevisionId,
          sourceMap: previous[0].sourceMap,
          matrixAuthorityEpoch: journalEpoch,
        })
        if (
          hashRecord(expected) !== hashRecord(current.journal) ||
          hashRecord(expected.operations.map((item) => item.operationId)) !== hashRecord(current.operationIds)
        )
          return failed()
        recordVerifiedJournal({
          presentationId: head.presentationId,
          generation: head.generation,
          packageRevisionId: head.packageRevisionId,
          matrixAuthorityEpoch: journalEpoch,
          previousProjection: previous[0].projection,
          currentProjection: current.projection,
          previousSourceMap: previous[0].sourceMap,
          journal: current.journal,
          operationIds: current.operationIds,
        })
      }
    } else {
      if (!hasValidCommittedJournal(current, head.journalRevisionId)) return failed()
    }
    return {
      ok: true,
      head,
      after: current.projection,
      sourceMap: current.sourceMap,
      pendingJournalHash: head.pendingJournalHash,
    }
  } catch {
    return failed()
  }
}

function createEditorPackageRead(store) {
  const state = store.getOwnedAuthorityState()
  // Preserve the exact owned publication and its validation identities. Public
  // reads remain detached; only the explicit read-only route shares authority.
  const snapshotStore = {
    getOwnedAuthorityState: () => state,
    getState: () => structuredClone(state),
    readBlob: (hash) => store.readBlob(hash),
  }
  return {
    state,
    verifyBytes: (head) => verifyEditorPackageBytesFromSnapshot(snapshotStore, head),
  }
}

async function verifyEditorPackageBytes(store, head) {
  return createEditorPackageRead(store).verifyBytes(head)
}

async function verifyEditorPackageBytesFromSnapshot(store, head) {
  try {
    await resolveImmutableOriginalRevisionBytes({ presentationId: head.presentationId }, { store })
    if (isOwned(store.getOwnedAuthorityState(), head.presentationId, head.packageRevisionId)) {
      await resolvePackageRevisionBytes(
        { presentationId: head.presentationId, revisionId: head.packageRevisionId },
        { store }
      )
    }
  } catch {
    throw snapshotError(
      'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      'Owned package bytes failed integrity verification'
    )
  }
}

module.exports = {
  retainPublishedSaveReceipts,
  readPackageAuthoritySnapshot,
  acquireOwnedAuthorityState,
  equivalentPublishedSaveSnapshot,
  resolveEditorProjectionContext,
  createEditorPackageRead,
  verifyEditorPackageBytes,
  publicPackageAuthoritySnapshot,
  recordVerifiedJournal,
  samePackageAuthority,
}
