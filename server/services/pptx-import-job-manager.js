const crypto = require('node:crypto')
const uuidv4 = () => crypto.randomUUID()

const JOB_TTL_MS = 10 * 60 * 1000
const MAX_CONCURRENT_RUNNING = 1
const jobs = new Map()
/** One-time handoff secrets: jobId -> capability plaintext. Cleared after take or cleanup. */
const jobCapabilities = new Map()

class PptxImportJobLimitError extends Error {
  constructor() {
    super('import-in-progress')
    this.code = 'import-in-progress'
  }
}

function hashCapability(secret) {
  return crypto.createHash('sha256').update(String(secret || ''), 'utf8').digest('hex')
}

function createJob() {
  if (runningCount() >= MAX_CONCURRENT_RUNNING) throw new PptxImportJobLimitError()
  const jobId = uuidv4()
  const capability = crypto.randomBytes(32).toString('hex')
  const controlCapabilityHash = hashCapability(capability)
  const now = Date.now()
  jobs.set(jobId, {
    jobId,
    status: 'running',
    stage: 'queued',
    percent: 0,
    message: 'Queued',
    result: null,
    error: null,
    failureType: null,
    failureCode: null,
    failureStage: null,
    controlCapabilityHash,
    createdAt: now,
    updatedAt: now,
    terminalState: false,
    operationPending: false,
    cleanupTimer: null,
    cancel: null,
    sseClients: new Set(),
  })
  jobCapabilities.set(jobId, capability)
  return jobId
}

/** Returns the one-time capability secret for admission response; does not log it. */
function takeJobCapability(jobId) {
  const capability = jobCapabilities.get(jobId)
  if (capability) jobCapabilities.delete(jobId)
  return capability || null
}

function getControlCapabilityHash(jobId) {
  return getJob(jobId)?.controlCapabilityHash || null
}

function verifyControlCapability(jobOrHash, providedSecret) {
  const expected = typeof jobOrHash === 'string'
    ? jobOrHash
    : jobOrHash?.controlCapabilityHash
  if (!expected) return false
  if (typeof providedSecret !== 'string' || !providedSecret) return false
  const actual = hashCapability(providedSecret)
  try {
    const a = Buffer.from(actual, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function runningCount() {
  let count = 0
  for (const job of jobs.values()) {
    if (job.status === 'running' || job.status === 'cancelling' || job.operationPending) count += 1
  }
  return count
}

function getJob(jobId) {
  return jobs.get(jobId) || null
}

function serializeJob(job) {
  if (!job) return null
  return {
    jobId: job.jobId,
    status: job.status,
    stage: job.stage,
    percent: job.percent,
    message: job.message,
    ...(job.result && { result: job.result }),
    ...(job.error && { error: job.error }),
    ...(job.failureType && { type: job.failureType }),
    ...(job.failureCode && { code: job.failureCode }),
    ...(job.failureStage && { failureStage: job.failureStage }),
  }
}

function attachSseClient(jobId, res) {
  const job = getJob(jobId)
  if (!job) return null
  if (job.cleanupTimer) {
    clearTimeout(job.cleanupTimer)
    job.cleanupTimer = null
  }
  job.sseClients.add(res)
  writeEvent(res, 'progress', serializeJob(job))
  if (job.terminalState) {
    writeEvent(res, terminalEvent(job.status), serializeJob(job))
    closeSseClients(job)
    scheduleCleanup(jobId)
  }
  return job
}

function detachSseClient(jobId, res) {
  const job = getJob(jobId)
  if (!job) return null
  job.sseClients.delete(res)
  if (job.sseClients.size === 0 && job.terminalState) scheduleCleanup(jobId)
  return job
}

function emitProgress(jobId, payload = {}) {
  const job = getJob(jobId)
  if (!job || job.terminalState) return null
  updateJob(job, {
    stage: payload.stage || job.stage,
    percent: normalizePercent(payload.percent, job.percent),
    message: payload.message || job.message,
  })
  broadcast(job, 'progress')
  return job
}

function completeJob(jobId, result) {
  return finishJob(jobId, 'done', { result, stage: 'complete', percent: 100, message: 'Import complete' })
}

function failJob(jobId, error) {
  const message =
    typeof error === 'string'
      ? error
      : error?.message || String(error || 'Import failed')
  const failureType =
    typeof error === 'object' && error && typeof error.type === 'string' ? error.type : null
  const failureCode =
    typeof error === 'object' && error && typeof error.code === 'string' ? error.code : null
  const failureStage =
    typeof error === 'object' && error && typeof error.stage === 'string'
      ? error.stage
      : 'failed'
  return finishJob(jobId, 'failed', {
    error: message,
    message,
    stage: failureStage,
    percent: 100,
    failureType,
    failureCode,
    failureStage,
  })
}

function cancelJob(jobId) {
  const job = getJob(jobId)
  if (!job) return 'unknown'
  if (job.status !== 'running') return 'conflict'
  job.cancel?.()
  updateJob(job, { status: 'cancelling', stage: 'cancelled', message: 'Cancelling import' })
  broadcast(job, 'progress')
  return 'ok'
}

function completeCancellation(jobId) {
  const job = getJob(jobId)
  if (!job || job.terminalState) return null
  return finishJob(jobId, 'cancelled', { stage: 'cancelled', message: 'Import cancelled', percent: job.percent })
}

function registerCancelHandler(jobId, cancel) {
  const job = getJob(jobId)
  if (job) job.cancel = cancel
  return job
}

function holdOperation(jobId) {
  const job = getJob(jobId)
  if (job) job.operationPending = true
  return job
}

function settleOperation(jobId) {
  const job = getJob(jobId)
  if (!job) return null
  job.operationPending = false
  if (job.terminalState) scheduleCleanup(jobId)
  return job
}

function finishJob(jobId, status, fields) {
  const job = getJob(jobId)
  if (!job || job.terminalState) return null
  updateJob(job, { ...fields, status, terminalState: true })
  broadcast(job, terminalEvent(status))
  closeSseClients(job)
  scheduleCleanup(jobId)
  return job
}

function updateJob(job, fields) {
  Object.assign(job, fields, { updatedAt: Date.now() })
}

function normalizePercent(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  const clamped = Math.max(0, Math.min(100, Math.round(number)))
  const previous = Number.isFinite(Number(fallback)) ? Number(fallback) : 0
  return Math.max(previous, clamped)
}

function terminalEvent(status) {
  if (status === 'done') return 'done'
  if (status === 'cancelled') return 'cancelled'
  return 'failed'
}

function broadcast(job, event) {
  const payload = serializeJob(job)
  for (const res of job.sseClients) writeEvent(res, event, payload)
}

function closeSseClients(job) {
  for (const res of job.sseClients) res.end?.()
  job.sseClients.clear()
}

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

function scheduleCleanup(jobId) {
  const job = getJob(jobId)
  if (!job || job.operationPending) return
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer)
  job.cleanupTimer = setTimeout(() => cleanup(jobId), JOB_TTL_MS)
  job.cleanupTimer.unref?.()
}

function cleanup(jobId) {
  const job = getJob(jobId)
  if (job?.cleanupTimer) clearTimeout(job.cleanupTimer)
  jobs.delete(jobId)
  jobCapabilities.delete(jobId)
}

function _reset() {
  for (const job of jobs.values()) {
    if (job.cleanupTimer) clearTimeout(job.cleanupTimer)
  }
  jobs.clear()
  jobCapabilities.clear()
}

module.exports = {
  JOB_TTL_MS,
  MAX_CONCURRENT_RUNNING,
  PptxImportJobLimitError,
  attachSseClient,
  cancelJob,
  cleanup,
  completeCancellation,
  completeJob,
  createJob,
  detachSseClient,
  emitProgress,
  failJob,
  getControlCapabilityHash,
  getJob,
  hashCapability,
  holdOperation,
  registerCancelHandler,
  serializeJob,
  settleOperation,
  takeJobCapability,
  verifyControlCapability,
  _reset,
}
