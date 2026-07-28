/** Mirrors server IMPORT_TIMEOUT_MS (2 min). Do not edit server routes from this module. */
export const PPTX_IMPORT_TIMEOUT_MS = 2 * 60 * 1000
/** Client wait slack past server import deadline (proxy / final poll). */
export const PPTX_JOB_WAIT_SLACK_MS = 30_000
export const DEFAULT_PPTX_JOB_MAX_WAIT_MS = PPTX_IMPORT_TIMEOUT_MS + PPTX_JOB_WAIT_SLACK_MS
/** Reserved window at the end of the absolute budget for a bounded final durable GET. */
export const PPTX_FINAL_STATUS_BUDGET_MS = 5_000
/**
 * Admission runs its own clock, separate from the wait budget above.
 *
 * The server admits one import at a time, so a queued upload can spend minutes
 * waiting for the slot. Sharing a single budget across both phases would let
 * that queue time eat the window the import itself needs, reporting an unknown
 * outcome for a job that went on to succeed.
 */
export const PPTX_ADMISSION_RETRY_DELAY_MS = 5_000
export const PPTX_ADMISSION_MAX_RETRIES = 72
export const PPTX_ADMISSION_MAX_WAIT_MS =
  PPTX_ADMISSION_MAX_RETRIES * PPTX_ADMISSION_RETRY_DELAY_MS

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

function createRequestTimeoutError() {
  const error = new Error('PPTX job request exceeded its transport budget')
  error.code = 'PPTX_JOB_REQUEST_TIMEOUT'
  return error
}

function boundedRequest({ request, signal, timeoutMs }) {
  if (signal?.aborted) return Promise.reject(createAbortError())
  const controller = new AbortController()
  let timer
  let onAbort
  let rejectAbort
  let rejectTimeout
  const abortPromise = new Promise((_resolve, reject) => {
    rejectAbort = reject
  })
  const timeoutPromise = new Promise((_resolve, reject) => {
    rejectTimeout = reject
  })
  const cleanup = () => {
    if (timer != null) clearTimeout(timer)
    signal?.removeEventListener?.('abort', onAbort)
  }
  const abortForCaller = () => {
    controller.abort()
    rejectAbort(createAbortError())
  }
  const abortForTimeout = () => {
    controller.abort()
    rejectTimeout(createRequestTimeoutError())
  }
  onAbort = abortForCaller
  signal?.addEventListener?.('abort', onAbort, { once: true })
  if (timeoutMs != null) {
    if (timeoutMs <= 0) abortForTimeout()
    else timer = setTimeout(abortForTimeout, timeoutMs)
  }
  const requestPromise = Promise.resolve().then(() => request(controller.signal))
  return Promise.race([requestPromise, abortPromise, timeoutPromise]).finally(cleanup)
}

export class PptxJobOutcomeError extends Error {
  constructor(message, {
    jobId,
    code = 'PPTX_JOB_FAILED',
    status,
    cause,
    failureType,
    failureCode,
    failureStage,
    reasonCode,
  } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'PptxJobOutcomeError'
    this.code = code
    this.jobId = jobId
    this.status = status
    this.failureType = failureType
    this.failureCode = failureCode
    this.failureStage = failureStage
    this.reasonCode = reasonCode
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
    // Durable receipts carry no typed `error`; their `message` is the only
    // account of what happened, so prefer it over the generic fallback.
    throw new PptxJobOutcomeError(job.error || job.message || `PPTX import ${job.status}`, {
      jobId,
      status: job.status,
      code: job.status === 'cancelled' ? 'PPTX_JOB_CANCELLED' : 'PPTX_JOB_FAILED',
      failureType: job.type,
      failureCode: job.code,
      failureStage: job.failureStage,
      reasonCode: job.reasonCode,
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
async function reconcileAfterDeadline({ jobId, api, onProgress, signal, capability }) {
  try {
    const finalJob = await api.pollPptxJob(jobId, { signal, capability })
    throwIfAborted(signal)
    if (finalJob?.message) onProgress?.(finalJob.message)
    const terminal = terminalResult(finalJob, jobId)
    if (terminal.done) return terminal.result
    throw new PptxJobOutcomeError(
      `PPTX import job ${jobId} reached the waiting deadline; its final outcome is not confirmed. Check existing presentations before retrying.`,
      {
        jobId,
        code: 'PPTX_JOB_OUTCOME_UNKNOWN',
        status: finalJob?.status || 'unknown',
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

async function finalStatusGet({ jobId, api, onProgress, signal, finalGetMs, capability }) {
  let outerAborted = false
  const onOuterAbort = () => {
    outerAborted = true
  }
  if (signal) {
    if (signal.aborted) throw createAbortError()
    signal.addEventListener('abort', onOuterAbort, { once: true })
  }
  const budget = finalGetMs == null ? PPTX_FINAL_STATUS_BUDGET_MS : Math.max(0, finalGetMs)
  try {
    return await boundedRequest({
      signal,
      timeoutMs: budget,
      request: (requestSignal) => reconcileAfterDeadline({
        jobId,
        api,
        onProgress,
        signal: requestSignal,
        capability,
      }),
    })
  } catch (error) {
    if (outerAborted) throw createAbortError()
    if (error?.name === 'AbortError' || error?.code === 'PPTX_JOB_REQUEST_TIMEOUT') {
      throw new PptxJobOutcomeError(
        `PPTX import job ${jobId} reached the waiting deadline and its final status could not be read. Check existing presentations before retrying.`,
        { jobId, code: 'PPTX_JOB_OUTCOME_UNKNOWN', status: 'unknown', cause: error }
      )
    }
    throw error
  } finally {
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

    const pollBudgetMs = useDeadline
      ? Math.max(0, transportUntil - Date.now())
      : PPTX_FINAL_STATUS_BUDGET_MS
    let job
    try {
      job = await boundedRequest({
        signal,
        timeoutMs: pollBudgetMs,
        request: (requestSignal) => api.pollPptxJob(jobId, {
          signal: requestSignal,
          capability,
        }),
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      if (error instanceof PptxJobOutcomeError) throw error
      // An admitted job can outlive one failed status transport; use the final
      // bounded read before exposing an unknown outcome to the caller.
      break
    }
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
  return finalStatusGet({ jobId, api, onProgress, signal, finalGetMs, capability })
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
    const transportController = new AbortController()
    const transportSignal = transportController.signal
    onConnection?.({ es: eventSource, jobId })

    const reportProgress = (message) => {
      if (!settled) onProgress?.(message)
    }

    const cleanupListeners = () => {
      if (budgetTimer != null) clearTimeout(budgetTimer)
      signal?.removeEventListener?.('abort', onAbort)
    }

    const finish = (callback, value) => {
      if (settled) return
      settled = true
      transportController.abort()
      cleanupListeners()
      eventSource.close()
      onConnection?.(null)
      callback(value)
    }

    const runFinalStatusRecovery = () => {
      if (settled || polling) return
      polling = true
      eventSource.close()
      const finalGetMs = remainingUntil(deadlineAt) ?? PPTX_FINAL_STATUS_BUDGET_MS
      finalStatusGet({
        jobId,
        api,
        onProgress: reportProgress,
        signal: transportSignal,
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
      if (settled || polling) return
      try {
        const progress = parse(event)
        if (progress.message) reportProgress(progress.message)
      } catch {
        // A malformed progress event is non-terminal. Polling remains available.
      }
    })
    eventSource.addEventListener('done', (event) => {
      if (settled) return
      try {
        finish(resolve, parse(event).result)
      } catch (err) {
        finish(reject, err)
      }
    })
    for (const status of ['failed', 'cancelled']) {
      eventSource.addEventListener(status, (event) => {
        if (settled) return
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
            failureType: payload.type,
            failureCode: payload.code,
            failureStage: payload.failureStage,
            reasonCode: payload.reasonCode,
          })
        )
      })
    }
    eventSource.onerror = () => {
      if (settled || polling) return
      polling = true
      if (budgetTimer != null) {
        clearTimeout(budgetTimer)
        budgetTimer = null
      }
      eventSource.close()
      const remaining = remainingUntil(deadlineAt)
      pollPptxJobUntilTerminal({
        jobId,
        api,
        onProgress: reportProgress,
        maxPollAttempts,
        pollIntervalMs,
        signal: transportSignal,
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
