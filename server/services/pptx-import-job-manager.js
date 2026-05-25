const uuidv4 = () => require('node:crypto').randomUUID()

const JOB_TTL_MS = 10 * 60 * 1000
const MAX_CONCURRENT_RUNNING = 1
const jobs = new Map()

class PptxImportJobLimitError extends Error {
  constructor() {
    super('import-in-progress')
    this.code = 'import-in-progress'
  }
}

function createJob() {
  if (runningCount() >= MAX_CONCURRENT_RUNNING) throw new PptxImportJobLimitError()
  const jobId = uuidv4()
  const now = Date.now()
  jobs.set(jobId, {
    jobId,
    status: 'running',
    stage: 'queued',
    percent: 0,
    message: 'Queued',
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
    terminalState: false,
    cleanupTimer: null,
    cancel: null,
    sseClients: new Set(),
  })
  return jobId
}

function runningCount() {
  let count = 0
  for (const job of jobs.values()) {
    if (job.status === 'running' || job.status === 'cancelling') count += 1
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
  if (job.terminalState) writeEvent(res, terminalEvent(job.status), serializeJob(job))
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
  const message = error?.message || String(error || 'Import failed')
  return finishJob(jobId, 'failed', { error: message, stage: 'failed', message, percent: 100 })
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

function finishJob(jobId, status, fields) {
  const job = getJob(jobId)
  if (!job || job.terminalState) return null
  updateJob(job, { ...fields, status, terminalState: true })
  broadcast(job, terminalEvent(status))
  if (job.sseClients.size === 0) scheduleCleanup(jobId)
  return job
}

function updateJob(job, fields) {
  Object.assign(job, fields, { updatedAt: Date.now() })
}

function normalizePercent(value, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.max(0, Math.min(100, Math.round(number)))
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

function writeEvent(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

function scheduleCleanup(jobId) {
  const job = getJob(jobId)
  if (!job) return
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer)
  job.cleanupTimer = setTimeout(() => cleanup(jobId), JOB_TTL_MS)
  job.cleanupTimer.unref?.()
}

function cleanup(jobId) {
  const job = getJob(jobId)
  if (job?.cleanupTimer) clearTimeout(job.cleanupTimer)
  jobs.delete(jobId)
}

function _reset() {
  for (const job of jobs.values()) {
    if (job.cleanupTimer) clearTimeout(job.cleanupTimer)
  }
  jobs.clear()
}

module.exports = { JOB_TTL_MS, MAX_CONCURRENT_RUNNING, PptxImportJobLimitError, attachSseClient, cancelJob, cleanup, completeCancellation, completeJob, createJob, detachSseClient, emitProgress, failJob, getJob, registerCancelHandler, serializeJob, _reset }
