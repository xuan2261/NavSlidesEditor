const fs = require('fs-extra')
const crypto = require('node:crypto')
const { readPresentations, withPresentations, UPLOAD_HASHES_FILE, withFileLock } = require('./storage')
const ownership = require('./media-placement-ownership')
const { buildImportedPresentation } = require('./project-import-presentation')
const { listSessions, readSession, updateSession } = require('./project-import-media-session-store')
const { withProjectImportSessionLock } = require('./project-import-media-session-lock')
const { assertStagingOwned, removeProjectImportStaging } = require('./project-import-staging-ownership')
const { recoverProjectPackage } = require('./project-import-package-session')
const { sameIdentity, sameIntent } = require('./project-import-media-session-identity')
const { cancelProjectImportUnlocked, isCancellationIntent } = require('./project-import-media-session-cancellation')

function receipt(record) {
  return { status: record.state, sessionId: record.sessionId,
    presentationId: record.intendedPresentationId, warnings: record.warnings || [] }
}
function matchesRow(row, record) {
  return row?._projectImport?.sessionId === record.sessionId &&
    row?._projectImport?.payloadDigest === record.payloadDigest
}
async function markReconcile(record, reason, signal) {
  return updateSession(record.sessionId, (current) => {
    signal?.throwIfAborted()
    if (!sameIntent(current, record)) throw new Error('Project import recovery identity changed')
    return { record: { ...current, state: 'reconcile-required', reconcileReason: reason },
      value: { status: 'reconcile-required' } }
  }, { signal })
}
async function verifyPlacements(record, signal) {
  const hashes = await withFileLock(UPLOAD_HASHES_FILE, async () => {
    signal?.throwIfAborted()
    try { return await fs.readJson(UPLOAD_HASHES_FILE) } catch (error) {
      if (error.code === 'ENOENT' && record.placements.length === 0) return {}
      throw error
    }
  })
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) throw new Error('Invalid media ownership ledger')
  if (record.placements.length !== record.media.length) throw new Error('Project import media checkpoint is incomplete')
  for (const item of record.placements) {
    signal?.throwIfAborted()
    const owned = Object.values(hashes.global || {}).some((candidate) => candidate?.filename === item.filename &&
      candidate.sha256 === item.sha256 && (item.ownership === 'reused'
        ? candidate.state === 'committed'
        : candidate.state === 'pending' && candidate.placementOwner === `project-import:${record.sessionId}` ||
          candidate.state === 'committed' && candidate.presentationId === record.intendedPresentationId))
    if (!owned) throw new Error('Project import media ownership cannot be proven')
    const bytes = await fs.readFile(item.absolutePath)
    signal?.throwIfAborted()
    if (bytes.length !== item.byteLength || crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256) {
      throw new Error('Project import media digest does not match checkpoint')
    }
  }
}
async function recoverProjectImportUnlocked(snapshot, { signal } = {}) {
  signal?.throwIfAborted()
  let record = await readSession(snapshot.sessionId)
  signal?.throwIfAborted()
  const terminal = record?.state === 'committed' || record?.state === 'rolled-back'
  // Terminal cleanup retires the package staging digest, not the retained commit identity.
  const identityMatches = terminal ? sameIdentity(record, snapshot) : sameIntent(record, snapshot)
  if (!identityMatches) throw Object.assign(new Error('Project import recovery identity changed'), {
    code: 'PROJECT_IMPORT_RECOVERY_REQUIRED', status: 503,
  })
  if (record.state === 'committed') return receipt(record)
  if (isCancellationIntent(record)) return cancelProjectImportUnlocked(record, { signal })
  if (!['committing', 'reconcile-required'].includes(record.state) || !record.intendedPresentationId) {
    return { status: record.state }
  }
  await assertStagingOwned(record, { signal })
  try {
    await verifyPlacements(record, signal)
    const expected = record.packageBundlePath === undefined ? buildImportedPresentation(record) : null
    const existing = (await readPresentations()).find((item) => item.id === record.intendedPresentationId)
    signal?.throwIfAborted()
    if (existing && !matchesRow(existing, record)) return markReconcile(record, 'PRESENTATION_CONFLICT', signal)
    if (record.packageBundlePath !== undefined) record = await recoverProjectPackage(record, { signal })
    if (!existing && record.packageBundlePath === undefined) {
      const accepted = await withPresentations((rows) => {
        signal?.throwIfAborted()
        const current = rows.find((item) => item.id === record.intendedPresentationId)
        if (current) return matchesRow(current, record)
        rows.push(expected)
        return true
      }, { signal })
      if (!accepted) return markReconcile(record, 'PRESENTATION_CONFLICT', signal)
    }
    signal?.throwIfAborted()
    await ownership.commitOwner(record.sessionId, record.intendedPresentationId, { signal })
    await removeProjectImportStaging(record, { signal })
    return updateSession(record.sessionId, (current) => {
      signal?.throwIfAborted()
      if (!sameIntent(current, record)) throw new Error('Project import recovery identity changed')
      const committed = { ...current, state: 'committed', committedAt: new Date().toISOString(),
        replayHash: current.capabilityHash, capabilityHash: undefined, revokedAt: new Date().toISOString(),
        presentation: undefined, media: undefined, packageBundlePath: undefined, packageBundleDigest: undefined, reconcileReason: undefined }
      return { record: committed, value: receipt(committed) }
    }, { signal })
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    await markReconcile(record, 'PROJECT_IMPORT_RECOVERY_FAILED', signal)
    throw error
  }
}
function recoverProjectImport(record, options) {
  return withProjectImportSessionLock(record.sessionId, () => recoverProjectImportUnlocked(record, options))
}
async function recoverProjectImports(options = {}) {
  const results = []
  for (const record of await listSessions()) {
    options.signal?.throwIfAborted()
    if (record.state === 'committing' || isCancellationIntent(record) ||
      record.state === 'reconcile-required' && record.intendedPresentationId) {
      results.push(await recoverProjectImport(record, options))
    }
  }
  return results
}
async function expirePendingProjectImports(now = Date.now(), { signal } = {}) {
  const results = []
  for (const snapshot of await listSessions()) {
    signal?.throwIfAborted()
    if (snapshot.state !== 'pending' || Date.parse(snapshot.expiresAt) > now) continue
    await withProjectImportSessionLock(snapshot.sessionId, async () => {
      const record = await readSession(snapshot.sessionId)
      signal?.throwIfAborted()
      if (!record || record.state !== 'pending' || Date.parse(record.expiresAt) > now) return
      await cancelProjectImportUnlocked(record, { signal, now, reason: 'PROJECT_IMPORT_EXPIRY_FAILED' })
      results.push(record.sessionId)
    })
  }
  return results
}
async function listReconcileRequiredProjectImports() {
  return (await listSessions()).filter((record) => record.state === 'reconcile-required')
}
module.exports = { expirePendingProjectImports, listReconcileRequiredProjectImports, recoverProjectImport, recoverProjectImports }
