const crypto = require('node:crypto')
const { getReadablePackageStore } = require('./package-store-runtime')
const { hashCanonical } = require('./evidence/canonical-hash')
const { hashRecord } = require('./package-store/schemas')
const { createSourceMap } = require('./source-map')
const { deriveMutationJournal } = require('./mutation-journal')
const { validateMatrixAuthoritySubjects } = require('./canonical-feature-matrix')
const { MUTATION_OPERATIONS: OPERATIONS } = require('./mutation-operation-scope')
const {
  resolveImmutableOriginalRevisionBytes,
  resolvePackageRevisionBytes,
} = require('./package-revision-resolver')

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
    if (candidates.length !== 1) return failed()
    const current = candidates[0]
    if (
      !editorResultAllowed(current) ||
      !validIdentity(current) ||
      current.state !== (pending ? 'pending-edited-export' : 'committed') ||
      hashRecord(current.projection) !== head.projectionRevisionId ||
      hashRecord(current.sourceMap) !== head.sourceMapRevisionId
    )
      return failed()
    if (pending) {
      if (
        head.journalRevisionId !== head.pendingJournalHash ||
        current.journal?.baseRevisionId !== head.packageRevisionId ||
        current.journal.journalHash !== head.pendingJournalHash
      )
        return failed()
      const anchors = results.filter(
        (result) =>
          result.state === 'committed' &&
          result.generation < head.generation &&
          validIdentity(result)
      )
      const previous = results.filter(
        (result) => result.generation === head.generation - 1 && validIdentity(result)
      )
      if (!anchors.length || previous.length !== 1) return failed()
      const expected = deriveMutationJournal(previous[0].projection, current.projection, {
        baseRevisionId: head.packageRevisionId,
        sourceMap: previous[0].sourceMap,
        matrixAuthorityEpoch: state.matrixAuthorityEpoch,
      })
      if (
        hashRecord(expected) !== hashRecord(current.journal) ||
        hashRecord(expected.operations.map((item) => item.operationId)) !==
          hashRecord(current.operationIds)
      )
        return failed()
    } else {
      if (
        (head.journalRevisionId ?? null) !== (current.journal?.journalHash ?? null) ||
        (current.operation === OPERATIONS.VALIDATED_EDITED_EXPORT && !current.journal)
      )
        return failed()
      if (current.journal) {
        const { journal } = current
        const subjects = Object.fromEntries(
          [
            'featureMatrixSchemaVersion',
            'featureMatrixVersion',
            'featureMatrixHash',
            'matrixAuthoritySubject',
            'reasonCodeSubject',
          ].map((key) => [key, journal[key]])
        )
        const payload = journal.metadata
          ? { operations: journal.operations, metadata: journal.metadata, subjects }
          : { ...subjects, operations: journal.operations }
        if (
          !Array.isArray(journal.operations) ||
          hashRecord(payload) !== journal.journalHash ||
          hashRecord(journal.operations.map((item) => item.operationId)) !==
            hashRecord(current.operationIds)
        )
          return failed()
      }
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

async function verifyEditorPackageBytes(store, head) {
  try {
    await resolveImmutableOriginalRevisionBytes({ presentationId: head.presentationId }, { store })
    if (isOwned(store.getState(), head.presentationId, head.packageRevisionId)) {
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
  readPackageAuthoritySnapshot,
  resolveEditorProjectionContext,
  verifyEditorPackageBytes,
  publicPackageAuthoritySnapshot,
  samePackageAuthority,
}
