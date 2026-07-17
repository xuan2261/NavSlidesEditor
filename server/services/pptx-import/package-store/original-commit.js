const { SCHEMA_VERSION, hashRecord, validateOwner, validateRevision } = require('./schemas')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')

async function commitOriginal(store, source, owner, options = {}) {
  validateOwner(owner)
  await store.assertWriter()
  const staged = await store.stageBlob(source, { expectedSha256: options.expectedSha256 })
  const blob = await store.blobs.commit(staged)
  const revisionId = `r0-${blob.sha256}`
  const revision = validateRevision({
    schemaVersion: SCHEMA_VERSION,
    id: revisionId,
    ordinal: 0,
    blobSha256: blob.sha256,
    manifestHash: options.manifestHash || null,
    createdAt: options.uploadedAt || new Date().toISOString(),
  })
  await store.mutate((next) => {
    if (!next.blobs.some((item) => item.sha256 === blob.sha256)) next.blobs.push(blob)
    if (!next.revisions.some((item) => item.id === revisionId)) next.revisions.push(revision)
    if (!next.owners.some((item) =>
      item.revisionId === revisionId &&
      item.ownerType === owner.ownerType &&
      item.ownerId === owner.ownerId
    )) next.owners.push({ schemaVersion: SCHEMA_VERSION, revisionId, ...owner })
    if (owner.ownerType !== 'presentation') return
    const predecessor = next.heads.find((head) => head.presentationId === owner.ownerId)
    next.heads = next.heads.filter((head) => head.presentationId !== owner.ownerId)
    next.heads.push({
      schemaVersion: SCHEMA_VERSION,
      presentationId: owner.ownerId,
      originalRevisionId: revisionId,
      projectionRevisionId: null,
      packageRevisionId: revisionId,
      sourceMapRevisionId: null,
      journalRevisionId: null,
      evidenceByClaim: {},
      matrixAuthorityEpoch: next.matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, next.matrixAuthorityEpoch),
      generation: (predecessor?.generation || 0) + 1,
      predecessorId: predecessor ? hashRecord(predecessor) : null,
      fencingEpoch: store.fencingEpoch,
    })
  }, options)
  return { blob, revision }
}

module.exports = { commitOriginal }
