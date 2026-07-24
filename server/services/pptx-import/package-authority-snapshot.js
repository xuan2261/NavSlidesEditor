const crypto = require('node:crypto')
const { getReadablePackageStore } = require('./package-store-runtime')
const { hashCanonical } = require('./evidence/canonical-hash')

function snapshotError(code, message) {
  return Object.assign(new Error(message), { code, status: 422 })
}

function isOwned(state, presentationId, revisionId) {
  return state.owners?.some((owner) =>
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
  const store = providedStore || await getReadablePackageStore()
  const state = store.getState()
  const head = state.heads.find((item) => item.presentationId === presentationId)
  if (!head) throw snapshotError('PACKAGE_HEAD_UNAVAILABLE', 'Authoritative package head is unavailable')
  if (!isOwned(state, presentationId, head.originalRevisionId) ||
      !isOwned(state, presentationId, head.packageRevisionId)) {
    throw snapshotError('CURRENT_SOURCE_AUTHORITY_UNAVAILABLE', 'Current package authority is unavailable')
  }
  const revision = state.revisions.find((item) => item.id === head.originalRevisionId)
  if (!revision || !isSha256(revision.blobSha256)) {
    throw snapshotError('IMMUTABLE_ORIGINAL_UNAVAILABLE', 'Immutable original package revision is unavailable')
  }
  let bytes
  try {
    bytes = await store.readBlob(revision.blobSha256)
  } catch {
    throw snapshotError('IMMUTABLE_ORIGINAL_BLOB_UNAVAILABLE', 'Immutable original package bytes are unavailable')
  }
  const originalSha256 = sha256(bytes)
  if (originalSha256 !== revision.blobSha256) {
    throw snapshotError('IMMUTABLE_ORIGINAL_CORRUPT', 'Immutable original package hash verification failed')
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
  if (typeof left.presentationId !== 'string' || !left.presentationId ||
      left.presentationId !== right.presentationId || typeof leftRevision !== 'string' || !leftRevision ||
      leftRevision !== rightRevision || !isSha256(leftHeadHash) || leftHeadHash !== rightHeadHash ||
      !Number.isSafeInteger(left.aggregateGeneration) || left.aggregateGeneration < 1 ||
      left.aggregateGeneration !== right.aggregateGeneration) return false
  const leftOriginalSha = left.originalSha256 ?? left.original?.sha256
  const rightOriginalSha = right.originalSha256 ?? right.original?.sha256
  const leftOriginalLength = left.originalByteLength ?? left.original?.byteLength
  const rightOriginalLength = right.originalByteLength ?? right.original?.byteLength
  const originalCompared = leftOriginalSha !== undefined || rightOriginalSha !== undefined ||
    leftOriginalLength !== undefined || rightOriginalLength !== undefined
  return !originalCompared || (leftOriginalSha === rightOriginalSha &&
    leftOriginalLength === rightOriginalLength)
}

module.exports = {
  readPackageAuthoritySnapshot,
  publicPackageAuthoritySnapshot,
  samePackageAuthority,
}
