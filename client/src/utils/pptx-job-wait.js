/** Mirrors server IMPORT_TIMEOUT_MS (2 min). Do not edit server routes from this module. */
export const PPTX_IMPORT_TIMEOUT_MS = 2 * 60 * 1000
/** Client wait slack past server import deadline (proxy / final poll). */
export const PPTX_JOB_WAIT_SLACK_MS = 30_000
export const DEFAULT_PPTX_JOB_MAX_WAIT_MS = PPTX_IMPORT_TIMEOUT_MS + PPTX_JOB_WAIT_SLACK_MS
/** Reserved window at the end of the absolute budget for a bounded final durable GET. */
export const PPTX_FINAL_STATUS_BUDGET_MS = 5_000

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

function remainingUntil(deadlineAt) {
  if (deadlineAt == null) return null
  return Math.max(0, deadlineAt - Date.now())
}

function transportBudgetMs(maxWaitMs) {
  if (maxWaitMs == null) return null
  // Always reserve a slice for final GET, even when the total budget is small.
  const reserve = Math.min(PPTX_FINAL_STATUS_BUDGET_MS, Math.max(1, Math.floor(maxWaitMs / 2)))
  return Math.max(0, maxWaitMs - reserve)
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
  if (job?.status === 'pending-visibility') {
    throw new PptxJobOutcomeError(
      job.message || 'PPTX import published; awaiting list visibility',
      {
        jobId,
        code: 'PPTX_JOB_PENDING_VISIBILITY',
        status: 'pending-visibility',
      }
    )
  }
  if (job?.status === 'failed' || job?.status === 'cancelled') {
    throw new PptxJobOutcomeError(job.error || `PPTX import ${job.status}`, {
      jobId,
      status: job.status,
      code: job.status === 'cancelled' ? 'PPTX_JOB_CANCELLED' : 'PPTX_JOB_FAILED',
    })
  }
  if (job?.status === 'reconcile-required') {
    throw new PptxJobOutcomeError(
      job.message || 'PPTX import requires manual reconciliation',
      {
        jobId,
        code: 'PPTX_JOB_RECONCILE_REQUIRED',
        status: 'reconcile-required',
      }
    )
  }
  return { done: false }
}

/**
 * Timeout recovery: GET-only final status. Never calls destructive POST reconcile.
 */
async function reconcileAfterDeadline({ jobId, api, onProgress, cancelError, signal, capability }) {
  try {
    const finalJob = await api.pollPptxJob(jobId, { signal, capability })
    if (finalJob?.message) onProgress?.(finalJob.message)
    const terminal = terminalResult(finalJob, jobId)
    if (terminal.done) return terminal.result
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

async function cancelThenFinalGet({ jobId, api, onProgress, signal, finalGetMs, capability }) {
  let cancelError
  try {
    // Control-plane cancel must not use an already-aborted transport signal.
    await api.cancelPptxJob(jobId, { capability })
  } catch (err) {
    cancelError = err
  }

  const finalController = new AbortController()
  const onOuterAbort = () => finalController.abort()
  if (signal) {
    if (signal.aborted) {
      throw createAbortError()
    }
    signal.addEventListener('abort', onOuterAbort, { once: true })
  }
  const budget = finalGetMs == null ? PPTX_FINAL_STATUS_BUDGET_MS : Math.max(0, finalGetMs)
  let budgetTimer
  if (budget > 0) {
    budgetTimer = setTimeout(() => finalController.abort(), budget)
  } else {
    finalController.abort()
  }
  try {
    return await reconcileAfterDeadline({
      jobId,
      api,
      onProgress,
      cancelError,
      signal: finalController.signal,
      capability,
    })
  } finally {
    if (budgetTimer != null) clearTimeout(budgetTimer)
    signal?.removeEventListener?.('abort', onOuterAbort)
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
  deadlineAt: deadlineAtOption = null,
  capability,
}) {
  throwIfAborted(signal)
  const deadlineAt =
    deadlineAtOption != null
      ? deadlineAtOption
      : maxWaitMs != null
        ? Date.now() + maxWaitMs
        : null
  const useDeadline = deadlineAt != null
  const transportUntil = useDeadline
    ? deadlineAt - Math.min(PPTX_FINAL_STATUS_BUDGET_MS, Math.max(0, deadlineAt - Date.now()))
    : null
  let attempt = 0

  while (true) {
    throwIfAborted(signal)
    if (useDeadline && Date.now() >= transportUntil) break
    if (!useDeadline && attempt >= maxPollAttempts) break

    const job = await api.pollPptxJob(jobId, { signal, capability })
    if (job?.message) onProgress?.(job.message)
    const terminal = terminalResult(job, jobId)
    if (terminal.done) return terminal.result

    attempt += 1
    if (useDeadline) {
      const remainingTransport = transportUntil - Date.now()
      if (remainingTransport <= 0) break
      await sleepWithSignal(Math.min(pollIntervalMs, remainingTransport), signal)
    } else if (attempt < maxPollAttempts) {
      await sleepWithSignal(pollIntervalMs, signal)
    } else {
      break
    }
  }

  const finalGetMs = useDeadline
    ? remainingUntil(deadlineAt)
    : PPTX_FINAL_STATUS_BUDGET_MS
  return cancelThenFinalGet({ jobId, api, onProgress, signal, finalGetMs, capability })
}

function streamUrlForJob(jobId, capability) {
  const base = `/api/pptx/jobs/${jobId}/stream`
  if (!capability) return base
  return `${base}?capability=${encodeURIComponent(capability)}`
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
  deadlineAt: deadlineAtOption = null,
  capability,
}) {
  const deadlineAt =
    deadlineAtOption != null
      ? deadlineAtOption
      : maxWaitMs != null
        ? Date.now() + maxWaitMs
        : null

  if (!EventSourceImpl) {
    onConnection?.({ jobId })
    return pollPptxJobUntilTerminal({
      jobId,
      api,
      onProgress,
      maxPollAttempts,
      pollIntervalMs,
      signal,
      deadlineAt,
      maxWaitMs: deadlineAt != null ? remainingUntil(deadlineAt) : maxWaitMs,
      capability,
    }).finally(() => {
      onConnection?.(null)
    })
  }

  return new Promise((resolve, reject) => {
    const eventSource = new EventSourceImpl(streamUrlForJob(jobId, capability))
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

    const runFinalStatusRecovery = () => {
      if (settled) return
      const finalGetMs = remainingUntil(deadlineAt) ?? PPTX_FINAL_STATUS_BUDGET_MS
      cancelThenFinalGet({
        jobId,
        api,
        onProgress,
        signal,
        finalGetMs,
        capability,
      }).then(
        (result) => finish(resolve, result),
        (err) => finish(reject, err)
      )
    }

    onAbort = () => {
      if (settled) return
      // Best-effort cancel on ownership loss; do not await for settle latency.
      api.cancelPptxJob(jobId, { capability }).catch(() => {})
      finish(reject, createAbortError())
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    if (deadlineAt != null) {
      const transportMs = Math.max(0, transportBudgetMs(remainingUntil(deadlineAt) ?? 0) ?? 0)
      budgetTimer = setTimeout(runFinalStatusRecovery, transportMs)
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
          new PptxJobOutcomeError(payload.error || `PPTX import ${status}`, {
            jobId,
            status,
            code: status === 'cancelled' ? 'PPTX_JOB_CANCELLED' : 'PPTX_JOB_FAILED',
          })
        )
      })
    }
    eventSource.onerror = () => {
      if (settled || polling) return
      polling = true
      eventSource.close()
      const remaining = remainingUntil(deadlineAt)
      pollPptxJobUntilTerminal({
        jobId,
        api,
        onProgress,
        maxPollAttempts,
        pollIntervalMs,
        signal,
        deadlineAt,
        maxWaitMs: remaining,
        capability,
      }).then(
        (result) => finish(resolve, result),
        (err) => finish(reject, err)
      )
    }
  })
}
