function auditCollection(state) {
  const referenced = new Set(
    state.owners
      .map((owner) => state.revisions.find((revision) => revision.id === owner.revisionId))
      .filter(Boolean)
      .map((revision) => revision.blobSha256)
  )
  const leasedRevisions = new Set(state.leases.map((lease) => lease.revisionId).filter(Boolean))
  const candidates = state.blobs
    .filter((blob) => !referenced.has(blob.sha256))
    .filter((blob) => !state.revisions.some(
      (revision) => revision.blobSha256 === blob.sha256 && leasedRevisions.has(revision.id)
    ))
    .map((blob) => blob.sha256)
  return {
    schemaVersion: 1,
    mode: 'audit-only',
    physicalDeletionEnabled: false,
    candidates,
  }
}

function auditBlobFiles(state, files) {
  const known = new Set(state.blobs.map((blob) => `${blob.sha256}.blob`))
  return { schemaVersion: 1, mode: 'audit-only', physicalDeletionEnabled: false,
    candidates: files.filter((file) => !known.has(file)).map((file) => file.slice(0, -'.blob'.length)).sort() }
}

module.exports = { auditBlobFiles, auditCollection }
