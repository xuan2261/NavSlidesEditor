const crypto = require('node:crypto')
const { openPackageStore } = require('./package-store')
const { getReadablePackageStore } = require('./package-store-runtime')
const { hashCanonical } = require('./evidence/canonical-hash')

function resolutionError(code, message) {
  return Object.assign(new Error(message), { code, status: 422 })
}

function hasPresentationOwner(state, presentationId, revisionId) {
  return state.owners?.some((owner) =>
    owner.ownerType === 'presentation' &&
    owner.ownerId === presentationId &&
    owner.revisionId === revisionId
  )
}

async function readRevisionBytes(store, revisionId, errors) {
  const revision = store.getState().revisions.find((item) => item.id === revisionId)
  if (!revision) throw resolutionError(errors.revision, errors.revisionMessage)

  let bytes
  try {
    bytes = await store.readBlob(revision.blobSha256)
  } catch {
    throw resolutionError(errors.blob, errors.blobMessage)
  }

  const actual = crypto.createHash('sha256').update(bytes).digest('hex')
  if (actual !== revision.blobSha256) {
    throw resolutionError(errors.corrupt, errors.corruptMessage)
  }
  return { bytes, sha256: actual, revisionId }
}

async function getStore(options) {
  return options.store || (options.rootDir
    ? openPackageStore({ rootDir: options.rootDir })
    : getReadablePackageStore())
}

async function resolvePackageRevisionBytes({ presentationId, revisionId }, options = {}) {
  const store = await getStore(options)
  const state = store.getState()
  const head = state.heads.find((item) => item.presentationId === presentationId)
  if (!head || head.packageRevisionId !== revisionId ||
      !hasPresentationOwner(state, presentationId, revisionId)) {
    throw resolutionError('PACKAGE_HEAD_UNAVAILABLE', 'Authoritative package head is unavailable')
  }
  return readRevisionBytes(store, revisionId, {
    revision: 'PACKAGE_REVISION_UNAVAILABLE',
    revisionMessage: 'Package revision is unavailable',
    blob: 'PACKAGE_BLOB_UNAVAILABLE',
    blobMessage: 'Package revision bytes are unavailable',
    corrupt: 'PACKAGE_BLOB_CORRUPT',
    corruptMessage: 'Package revision hash verification failed',
  })
}

async function resolveImmutableOriginalRevisionBytes({ presentationId }, options = {}) {
  const store = await getStore(options)
  const state = store.getState()
  const head = state.heads.find((item) => item.presentationId === presentationId)
  if (!head || typeof head.originalRevisionId !== 'string' || !head.originalRevisionId ||
      !hasPresentationOwner(state, presentationId, head.originalRevisionId)) {
    throw resolutionError(
      'IMMUTABLE_ORIGINAL_UNAVAILABLE',
      'Immutable original package revision is unavailable'
    )
  }
  if (options.expectedGeneration !== undefined &&
      head.generation !== options.expectedGeneration) {
    throw Object.assign(new Error('Package generation is stale'), {
      code: 'STALE_GENERATION',
      status: 409,
      currentGeneration: head.generation,
    })
  }
  if (options.expectedPackageRevisionId !== undefined &&
      head.packageRevisionId !== options.expectedPackageRevisionId) {
    throw Object.assign(new Error('Package authority is stale'), {
      code: 'STALE_PACKAGE_AUTHORITY',
      status: 409,
      currentRevisionId: head.packageRevisionId,
    })
  }
  if (options.expectedPackageHeadHash !== undefined &&
      hashCanonical(head) !== options.expectedPackageHeadHash) {
    throw Object.assign(new Error('Package authority is stale'), {
      code: 'STALE_PACKAGE_AUTHORITY',
      status: 409,
      currentHeadHash: hashCanonical(head),
    })
  }
  return readRevisionBytes(store, head.originalRevisionId, {
    revision: 'IMMUTABLE_ORIGINAL_REVISION_UNAVAILABLE',
    revisionMessage: 'Immutable original package revision is unavailable',
    blob: 'IMMUTABLE_ORIGINAL_BLOB_UNAVAILABLE',
    blobMessage: 'Immutable original package bytes are unavailable',
    corrupt: 'IMMUTABLE_ORIGINAL_CORRUPT',
    corruptMessage: 'Immutable original package hash verification failed',
  })
}

module.exports = {
  resolveImmutableOriginalRevisionBytes,
  resolvePackageRevisionBytes,
}
