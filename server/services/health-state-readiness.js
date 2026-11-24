const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { UPLOAD_HASHES_FILE, withFileLock, UPLOADS_DIR } = require('./storage')
const { hashCanonical } = require('./pptx-import/evidence/canonical-hash')
const { resolvePackageBackedReadFromState } = require('./package-backed-presentation-read')
const ownership = require('./media-placement-ownership')
const recovery = require('./project-import-media-session-recovery')
const { listSessions } = require('./project-import-media-session-store')
const logger = require('./logger')

async function assertWritableRoot(rootDir) {
  const probe = path.join(rootDir, `.navslides-write-probe-${process.pid}-${crypto.randomUUID()}`)
  try {
    await fs.writeFile(probe, '', { flag: 'wx', mode: 0o600 })
  } finally {
    await fs.rm(probe, { force: true }).catch(() => {})
  }
}

function durableRecoveryReason(state, sessions = [], media = []) {
  if (state?.compatibilityDeadLetter?.length || state?.compatibilityOutbox?.length ||
      state?.jobs?.some((job) => job?.reconcileRequired === true ||
        ['queued', 'running'].includes(job?.status) ||
        ['requested', 'leased', 'staged', 'validated', 'committing', 'apply-pending', 'applied-unacked',
          'reconcile-required', 'quarantined'].includes(job?.transactionState)) ||
      sessions.some((record) => ['committing', 'reconcile-required'].includes(record.state) ||
        record.state === 'pending' && (record.placements.length > 0 || Date.parse(record.expiresAt) <= Date.now())) ||
      media.some((record) => record.state === 'pending')) return 'DURABLE_RECOVERY_REQUIRED'
  return null
}

async function readMediaIntents(signal) {
  return withFileLock(UPLOAD_HASHES_FILE, async () => {
    signal?.throwIfAborted()
    let hashes
    try { hashes = JSON.parse(await fs.readFile(UPLOAD_HASHES_FILE, 'utf8')) } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
    if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) throw new Error('Invalid media ownership ledger')
    const records = []
    for (const bucket of Object.values(hashes)) {
      if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) throw new Error('Invalid media ownership bucket')
      for (const record of Object.values(bucket)) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid media ownership record')
        if (record.state === 'pending' &&
            (typeof record.placementOwner !== 'string' || !/^(project-import|pptx-import):[a-zA-Z0-9_-]+$/u.test(record.placementOwner) ||
             typeof record.filename !== 'string' || path.basename(record.filename) !== record.filename ||
             !/^[a-f0-9]{64}$/u.test(record.sha256) || !Number.isSafeInteger(record.size) || record.size < 0)) {
          throw new Error('Invalid pending media identity')
        }
        records.push(record)
      }
    }
    return records
  })
}

async function recoverPptxMedia(store, records, signal) {
  const groups = new Map()
  for (const record of records) {
    if (record.state !== 'pending' || !record.placementOwner.startsWith('pptx-import:')) continue
    const jobId = record.placementOwner.slice('pptx-import:'.length)
    if (!groups.has(jobId)) groups.set(jobId, [])
    groups.get(jobId).push(record)
  }
  const { readPresentations } = require('./storage')
  for (const [jobId, media] of groups) {
    signal.throwIfAborted()
    const state = store.getState()
    const job = state.jobs.find((item) => item.id === jobId)
    const head = state.heads.find((item) => item.presentationId === job?.presentationId)
    if (!head || job.kind !== 'import' || job.status !== 'completed' ||
        job.outcomeRevisionId !== head.packageRevisionId || head.originalRevisionId !== head.packageRevisionId ||
        job.outcomeGeneration !== head.generation || job.outcomeHeadHash !== hashCanonical(head)) continue
    const row = (await readPresentations()).find((item) => item.id === head.presentationId)
    signal.throwIfAborted()
    if (!row) continue
    resolvePackageBackedReadFromState(state, head.presentationId, row)
    await store.readOriginal(head.originalRevisionId)
    for (const item of media) {
      signal.throwIfAborted()
      const bytes = await fs.readFile(path.join(path.resolve(UPLOADS_DIR), item.filename))
      if (bytes.length !== item.size || crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256) {
        throw new Error('Pending PPTX media digest requires recovery')
      }
    }
    signal.throwIfAborted()
    await ownership.commitOwner(jobId, head.presentationId, { scope: 'pptx-import', signal })
  }
}

async function recoverStartupState(store, { timeoutMs = 5000 } = {}) {
  const controller = new AbortController()
  let timer
  const expired = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort(Object.assign(new Error('Startup recovery deadline exceeded'), { code: 'STARTUP_RECOVERY_TIMEOUT' }))
      logger.warn('[startup] durable recovery deadline exceeded; back up and inspect retained package/session/media intents before restarting')
      resolve('DURABLE_RECOVERY_REQUIRED')
    }, timeoutMs)
  })
  const work = (async () => {
    await require('./pptx-import/package-store-runtime').drainPackageCompatibilityOutbox({ signal: controller.signal })
    controller.signal.throwIfAborted()
    await recovery.recoverProjectImports({ signal: controller.signal })
    controller.signal.throwIfAborted()
    await recovery.expirePendingProjectImports(Date.now(), { signal: controller.signal })
    controller.signal.throwIfAborted()
    await recoverPptxMedia(store, await readMediaIntents(controller.signal), controller.signal)
    controller.signal.throwIfAborted()
    const sessions = await listSessions()
    const media = await readMediaIntents(controller.signal)
    controller.signal.throwIfAborted()
    return durableRecoveryReason(store.getState(), sessions, media)
  })().catch((error) => {
    // A late completion never clears the degraded startup decision. Only a new
    // startup retries; the retained authority remains available for inspection.
    if (!controller.signal.aborted) {
      logger.warn('[startup] durable recovery requires backup, inspection and repair before restart:',
        /^[A-Z][A-Z0-9_]{1,63}$/u.test(error?.code || '') ? error.code : 'DURABLE_RECOVERY_REQUIRED')
      controller.abort(error)
    }
    return 'DURABLE_RECOVERY_REQUIRED'
  })
  try { return await Promise.race([work, expired]) } finally { clearTimeout(timer) }
}

module.exports = { assertWritableRoot, durableRecoveryReason, recoverStartupState }
