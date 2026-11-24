const crypto = require('node:crypto')
const fs = require('fs-extra')
const { UPLOAD_HASHES_FILE, withFileLock } = require('./storage')
const ownership = require('./media-placement-ownership')
const { assertStagingOwned, inspectPath, removeProjectImportStaging, stagingError } = require('./project-import-staging-ownership')
const { updateSession } = require('./project-import-media-session-store')
const { sameIntent } = require('./project-import-media-session-identity')

const REASONS = new Set(['PROJECT_IMPORT_ROLLBACK_FAILED', 'PROJECT_IMPORT_EXPIRY_FAILED'])
function isCancellationIntent(record) {
  return record?.state === 'reconcile-required' && REASONS.has(record.reconcileReason) &&
    record.intendedPresentationId === undefined && record.commitStartedAt === undefined &&
    record.leaseId === undefined && record.packageOutcome === undefined
}
async function verifyCancellationPlacements(record, signal) {
  try {
    await withFileLock(UPLOAD_HASHES_FILE, async () => {
      signal?.throwIfAborted()
      let hashes
      try { hashes = await fs.readJson(UPLOAD_HASHES_FILE) } catch (error) {
        if (error.code !== 'ENOENT') throw error
        hashes = {}
      }
      if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) throw stagingError()
      const entries = []
      for (const bucket of Object.values(hashes)) {
        if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) throw stagingError()
        entries.push(...Object.values(bucket))
      }
      const ownerKey = `project-import:${record.sessionId}`
      const owned = Object.values(hashes.global || {}).filter(item => item?.placementOwner === ownerKey)
      if (owned.some(item => !record.placements.some(placed => placed.ownership === 'new' &&
        placed.filename === item.filename && placed.sha256 === item.sha256))) throw stagingError()
      for (const placed of record.placements) {
        signal?.throwIfAborted()
        const matches = entries.filter(item => item?.filename === placed.filename)
        if (placed.ownership === 'reused') {
          if (!matches.some(item => item.state === 'committed' && item.sha256 === placed.sha256)) throw stagingError()
          continue
        }
        // Missing own bytes/entries are valid after a partial cancellation, never
        // when another owner or changed content now occupies the checkpoint.
        if (matches.some(item => item.state !== 'pending' || item.placementOwner !== ownerKey ||
          item.sha256 !== placed.sha256)) throw stagingError()
        const stat = await inspectPath(placed.absolutePath, { allowMissing: true, signal })
        if (!stat) continue
        if (!stat.isFile() || !owned.some(item => item.filename === placed.filename &&
          item.state === 'pending' && item.sha256 === placed.sha256)) throw stagingError()
        const bytes = await fs.readFile(placed.absolutePath)
        signal?.throwIfAborted()
        if (bytes.length !== placed.byteLength || crypto.createHash('sha256').update(bytes).digest('hex') !== placed.sha256) {
          throw stagingError()
        }
      }
    })
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    throw stagingError(error)
  }
}
async function cancelProjectImportUnlocked(record, { signal, now = Date.now(), reason = 'PROJECT_IMPORT_ROLLBACK_FAILED' } = {}) {
  signal?.throwIfAborted()
  if (record.state !== 'pending' && !isCancellationIntent(record)) throw stagingError()
  const failureReason = isCancellationIntent(record) ? record.reconcileReason : reason
  if (record.intendedPresentationId !== undefined || record.commitStartedAt !== undefined ||
    record.leaseId !== undefined || record.packageOutcome !== undefined) throw stagingError()
  await assertStagingOwned(record, { signal })
  await verifyCancellationPlacements(record, signal)
  try {
    await ownership.rollbackOwner(record.sessionId, { signal })
    await removeProjectImportStaging(record, { signal })
    return await updateSession(record.sessionId, current => {
      signal?.throwIfAborted()
      if (!sameIntent(current, record) || current.state !== record.state ||
        current.reconcileReason !== record.reconcileReason) throw stagingError()
      const timestamp = new Date(now).toISOString()
      return { record: { ...current, state: 'rolled-back', rolledBackAt: timestamp,
        replayHash: current.capabilityHash, capabilityHash: undefined, revokedAt: timestamp,
        presentation: undefined, media: undefined, packageBundlePath: undefined,
        packageBundleDigest: undefined, reconcileReason: undefined }, value: { status: 'rolled-back' } }
    }, { signal })
  } catch (error) {
    if (signal?.aborted || error.code === 'PROJECT_IMPORT_RECOVERY_REQUIRED') throw error
    await updateSession(record.sessionId, current => {
      signal?.throwIfAborted()
      if (!sameIntent(current, record) || current.state !== record.state ||
        current.reconcileReason !== record.reconcileReason) throw stagingError()
      return { record: { ...current, state: 'reconcile-required', reconcileReason: failureReason } }
    }, { signal })
    throw error
  }
}
module.exports = { cancelProjectImportUnlocked, isCancellationIntent }
