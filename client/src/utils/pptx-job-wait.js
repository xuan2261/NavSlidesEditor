/** Mirrors server IMPORT_TIMEOUT_MS (2 min). Do not edit server routes from this module. */
export const PPTX_IMPORT_TIMEOUT_MS = 2 * 60 * 1000
/** Client wait slack past server import deadline (proxy / final poll). */
export const PPTX_JOB_WAIT_SLACK_MS = 30_000
export const DEFAULT_PPTX_JOB_MAX_WAIT_MS = PPTX_IMPORT_TIMEOUT_MS + PPTX_JOB_WAIT_SLACK_MS

function createAbortError() {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw createAbortError()
}

function sleepWithSignal(ms, signal) {
  if (signal?.aborted) return Promise.reject(createAbortError())
  if (!(ms > 0)) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let settled = false
    let timer
    let onAbort
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', onAbort)
    }
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    onAbort = () => finish(reject, createAbortError())
    timer = setTimeout(() => finish(resolve), ms)
    signal?.addEventListener?.('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
  })
}

export class PptxJobOutcomeError extends Error {
  constructor(message, { jobId, code = 'PPTX_JOB_FAILED', status, cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'PptxJobOutcomeError'
    this.code = code
    this.jobId = jobId
    this.status = status
  }
}

function terminalResult(job, jobId) {
  if (job?.status === 'done') return { done: true, result: job.result }
  if (job?.status === 'failed' || job?.status === 'cancelled') {
    throw new PptxJobOutcomeError(job.error || `PPTX import ${job.status}`, {
      jobId,
      status: job.status,
    })
  }
  return { done: false }
}

async function reconcileAfterDeadline({ jobId, api, onProgress, cancelError, signal }) {
  try {
    const finalJob = await api.pollPptxJob(jobId, { signal })
    if (finalJob?.message) onProgress?.(finalJob.message)
    if (finalJob?.status === 'done') return finalJob.result
    if (finalJob?.status === 'failed') {
      throw new PptxJobOutcomeError(finalJob.error || 'PPTX import failed', {
        jobId,
        status: 'failed',
      })
    }
    throw new PptxJobOutcomeError(
      `PPTX import job ${jobId} reached the waiting deadline. Cancellation was requested, but its final outcome is not confirmed. Check existing presentations before retrying.`,
      {
        jobId,
        code: 'PPTX_JOB_OUTCOME_UNKNOWN',
        status: finalJob?.status || 'unknown',
        cause: cancelError,
      }
    )
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    if (err instanceof PptxJobOutcomeError) throw err
    throw new PptxJobOutcomeError(
      `PPTX import job ${jobId} reached the waiting deadline and could not be reconciled. Check existing presentations before retrying.`,
      {
        jobId,
        code: 'PPTX_JOB_OUTCOME_UNKNOWN',
        status: 'unknown',
        cause: err,
      }
    )
  }
}

export async function pollPptxJobUntilTerminal({
  jobId,
  api,
  onProgress,
  maxPollAttempts = 120,
  pollIntervalMs = 1000,
  signal,
  maxWaitMs,
}) {
  throwIfAborted(signal)
  const useDeadline = maxWaitMs != null
  const deadlineAt = useDeadline ? Date.now() + maxWaitMs : null
  let attempt = 0

  while (true) {
    throwIfAborted(signal)
    if (useDeadline && Date.now() >= deadlineAt) break
    if (!useDeadline && attempt >= maxPollAttempts) break

    const job = await api.pollPptxJob(jobId, { signal })
    if (job?.message) onProgress?.(job.message)
    const terminal = terminalResult(job, jobId)
    if (terminal.done) return terminal.result

    attempt += 1
    if (useDeadline) {
      const remaining = deadlineAt - Date.now()
      if (remaining <= 0) break
      await sleepWithSignal(Math.min(pollIntervalMs, remaining), signal)
    } else if (attempt < maxPollAttempts) {
      await sleepWithSignal(pollIntervalMs, signal)
    } else {
      break
    }
  }

  let cancelError
  try {
    // Do not pass aborted signal — cancel must still reach the server.
    await api.cancelPptxJob(jobId)
  } catch (err) {
    cancelError = err
  }

  return reconcileAfterDeadline({ jobId, api, onProgress, cancelError, signal })
}

export function waitForPptxJob({
  jobId,
  api,
  EventSourceImpl = globalThis.EventSource,
  onProgress,
  onConnection,
  maxPollAttempts = 120,
  pollIntervalMs = 1000,
  signal,
  maxWaitMs = DEFAULT_PPTX_JOB_MAX_WAIT_MS,
}) {
  if (!EventSourceImpl) {
    onConnection?.({ jobId })
    return pollPptxJobUntilTerminal({
      jobId,
      api,
      onProgress,
      maxPollAttempts,
      pollIntervalMs,
      signal,
      maxWaitMs,
    }).finally(() => {
      onConnection?.(null)
    })
  }

  return new Promise((resolve, reject) => {
    const eventSource = new EventSourceImpl(`/api/pptx/jobs/${jobId}/stream`)
    let settled = false
    let polling = false
    let budgetTimer
    let onAbort
    onConnection?.({ es: eventSource, jobId })

    const cleanupListeners = () => {
      if (budgetTimer != null) clearTimeout(budgetTimer)
      signal?.removeEventListener?.('abort', onAbort)
    }

    const finish = (callback, value) => {
      if (settled) return
      settled = true
      cleanupListeners()
      eventSource.close()
      onConnection?.(null)
      callback(value)
    }

    const rejectBudgetUnknown = () => {
      if (settled) return
      // Best-effort cancel; do not await — budget reject must be synchronous for settle.
      api.cancelPptxJob(jobId).catch(() => {})
      finish(
        reject,
        new PptxJobOutcomeError(
          `PPTX import job ${jobId} reached the waiting deadline. Cancellation was requested, but its final outcome is not confirmed. Check existing presentations before retrying.`,
          {
            jobId,
            code: 'PPTX_JOB_OUTCOME_UNKNOWN',
            status: 'unknown',
          }
        )
      )
    }

    onAbort = () => {
      if (settled) return
      api.cancelPptxJob(jobId).catch(() => {})
      finish(reject, createAbortError())
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    if (maxWaitMs != null && maxWaitMs >= 0) {
      budgetTimer = setTimeout(rejectBudgetUnknown, maxWaitMs)
    }

    const parse = (event) => JSON.parse(event.data)

    eventSource.addEventListener('progress', (event) => {
      try {
        const progress = parse(event)
        if (progress.message) onProgress?.(progress.message)
      } catch {
        // A malformed progress event is non-terminal. Polling remains available.
      }
    })
    eventSource.addEventListener('done', (event) => {
      try {
        finish(resolve, parse(event).result)
      } catch (err) {
        finish(reject, err)
      }
    })
    for (const status of ['failed', 'cancelled']) {
      eventSource.addEventListener(status, (event) => {
        let payload = {}
        try {
          payload = parse(event)
        } catch {
          // Use the terminal status fallback below.
        }
        finish(
          reject,
          new PptxJobOutcomeError(payload.error || `PPTX import ${status}`, { jobId, status })
        )
      })
    }
    eventSource.onerror = () => {
      if (settled || polling) return
      polling = true
      eventSource.close()
      pollPptxJobUntilTerminal({
        jobId,
        api,
        onProgress,
        maxPollAttempts,
        pollIntervalMs,
        signal,
        maxWaitMs,
      }).then(
        (result) => finish(resolve, result),
        (err) => finish(reject, err)
      )
    }
  })
}
