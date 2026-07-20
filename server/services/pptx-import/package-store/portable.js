const crypto = require('node:crypto')
const { SCHEMA_VERSION } = require('./schemas')

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const clone = (value) => structuredClone(value)

async function exportPresentationPackage(store, presentationId) {
  const state = store.getState()
  const head = state.heads.find((item) => item.presentationId === presentationId)
  if (!head) return null
  const revisionIds = new Set([
    head.originalRevisionId,
    head.projectionRevisionId,
    head.packageRevisionId,
    head.sourceMapRevisionId,
    head.journalRevisionId,
  ].filter(Boolean))
  const revisions = state.revisions.filter((item) => revisionIds.has(item.id))
  const blobs = []
  for (const revision of revisions) {
    const bytes = await store.readBlob(revision.blobSha256)
    if (!bytes || sha256(bytes) !== revision.blobSha256) {
      throw Object.assign(new Error('Portable export package verification failed'), {
        code: 'PACKAGE_HASH_MISMATCH',
      })
    }
    blobs.push({ sha256: revision.blobSha256, byteLength: bytes.byteLength, bytes })
  }
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      presentationId,
      head: clone(head),
      revisions: clone(revisions),
      blobs: blobs.map(({ bytes: _bytes, ...blob }) => blob),
    },
    blobs,
  }
}

async function importPresentationPackage(store, bundle, presentationId, options = {}) {
  const manifest = bundle?.manifest
  if (!manifest || manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new TypeError('Invalid portable package manifest')
  }
  if (options.admissionPreflight) await options.admissionPreflight(manifest)
  const supplied = new Map((bundle.blobs || []).map((blob) => [blob.sha256, blob]))
  const committed = []
  for (const descriptor of manifest.blobs || []) {
    const blob = supplied.get(descriptor.sha256)
    if (!blob || blob.byteLength !== descriptor.byteLength ||
        sha256(blob.bytes) !== descriptor.sha256) {
      throw Object.assign(new Error('Portable import package verification failed'), {
        code: 'PACKAGE_HASH_MISMATCH',
      })
    }
    const staged = await store.stageBlob(blob.bytes, { expectedSha256: descriptor.sha256 })
    committed.push(await store.blobs.commit(staged))
  }
  await store.mutate((next) => {
    for (const blob of committed) {
      if (!next.blobs.some((item) => item.sha256 === blob.sha256)) next.blobs.push(blob)
    }
    for (const revision of manifest.revisions) {
      if (!next.revisions.some((item) => item.id === revision.id)) next.revisions.push(revision)
    }
    next.heads = next.heads.filter((item) => item.presentationId !== presentationId)
    next.heads.push({
      ...clone(manifest.head),
      presentationId,
      generation: 1,
      predecessorId: null,
      fencingEpoch: store.fencingEpoch,
    })
    for (const revision of manifest.revisions) {
      next.owners.push({
        schemaVersion: SCHEMA_VERSION,
        revisionId: revision.id,
        ownerType: 'presentation',
        ownerId: presentationId,
      })
    }
  }, options)
  return store.getState().heads.find((item) => item.presentationId === presentationId)
}

module.exports = { exportPresentationPackage, importPresentationPackage }
