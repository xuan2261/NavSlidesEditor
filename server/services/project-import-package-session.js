const crypto = require('node:crypto')
const { readPresentations } = require('./storage')
const { readStagedPackage } = require('./project-import-package-staging')
const { updateSession } = require('./project-import-media-session-store')
const { buildImportedPresentation, rewritePresentationMedia } = require('./project-import-presentation')
const { withPackageStore, drainPackageCompatibilityOutbox } = require('./pptx-import/package-store-runtime')
const { hashRecord } = require('./pptx-import/package-store/schemas')
const { canonicalEditableSnapshot } = require('./pptx-import/canonical-snapshot')
const { resolvePackageBackedReadFromState } = require('./package-backed-presentation-read')
const { sessionError } = require('./project-import-capability')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const conflict = () => sessionError('SYNC_DESTINATION_CHANGED', 'Published package differs from the retained project import outcome', 409)

function exactHead(state, record) {
  const heads = state.heads.filter((head) => head.presentationId === record.intendedPresentationId)
  if (heads.length !== 1 || !record.packageOutcome || hashRecord(heads[0]) !== hashRecord(record.packageOutcome.head)) throw conflict()
  return heads[0]
}
function sameIntent(current, record) {
  return current && ['committing', 'reconcile-required'].includes(current.state) &&
    current.sessionId === record.sessionId && current.leaseId === record.leaseId &&
    current.intendedPresentationId === record.intendedPresentationId &&
    current.archiveDigest === record.archiveDigest && current.payloadDigest === record.payloadDigest &&
    current.packageBundleDigest === record.packageBundleDigest && current.packageBundlePath === record.packageBundlePath
}

async function recoverProjectPackage(record, { signal } = {}) {
  if (record.packageBundlePath === undefined) return record
  record = await withPackageStore(async (store) => {
    signal?.throwIfAborted()
    const heads = store.getState().heads.filter((head) => head.presentationId === record.intendedPresentationId)
    if (heads.length) { exactHead(store.getState(), record); return record }
    const bundle = await readStagedPackage(record, { signal })
    const mediaUrlMap = Object.fromEntries(record.placements.map((item) => [item.originalUrl, `/uploads/${item.filename}`]))
    const original = bundle.manifest.revisions.find((revision) => revision.id === bundle.manifest.head.originalRevisionId)
    const originalBlob = bundle.manifest.blobs.find((blob) => blob.sha256 === original.blobSha256)
    await store.importPresentationPackage(bundle, record.intendedPresentationId, {
      signal, mediaUrlMap,
      beforePublication: async ({ head, projection }) => {
        signal?.throwIfAborted()
        const presentation = projection || { ...rewritePresentationMedia(record.presentation, mediaUrlMap), id: record.intendedPresentationId }
        const checkpoint = { ...record, presentation,
          packageOutcome: { head, originalSha256: original.blobSha256, originalByteLength: originalBlob.byteLength } }
        record = await updateSession(record.sessionId, (current) => {
          if (!sameIntent(current, record)) throw conflict()
          return { record: { ...current, presentation: checkpoint.presentation, packageOutcome: checkpoint.packageOutcome }, value: checkpoint }
        }, { signal })
        return buildImportedPresentation(record)
      },
    })
    return record
  })
  signal?.throwIfAborted()
  // Never reacquire package serialization from inside its publication callback.
  await drainPackageCompatibilityOutbox({ signal })
  await withPackageStore(async (store) => {
    signal?.throwIfAborted()
    const state = store.getState(), head = exactHead(state, record)
    const raw = (await readPresentations()).find((row) => row.id === record.intendedPresentationId)
    if (!raw || hashRecord(canonicalEditableSnapshot(raw)) !== hashRecord(canonicalEditableSnapshot(buildImportedPresentation(record)))) throw conflict()
    resolvePackageBackedReadFromState(state, record.intendedPresentationId, raw)
    const bytes = await store.readOriginal(head.originalRevisionId)
    signal?.throwIfAborted()
    if (bytes.length !== record.packageOutcome.originalByteLength || sha(bytes) !== record.packageOutcome.originalSha256) throw conflict()
  })
  return record
}

module.exports = { recoverProjectPackage }
