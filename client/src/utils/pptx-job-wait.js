const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

export async function pollPptxJobUntilTerminal({
  jobId,
  api,
  onProgress,
  maxPollAttempts = 120,
  pollIntervalMs = 1000,
}) {
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const job = await api.pollPptxJob(jobId)
    if (job?.message) onProgress?.(job.message)
    const terminal = terminalResult(job, jobId)
    if (terminal.done) return terminal.result
    if (attempt + 1 < maxPollAttempts) await sleep(pollIntervalMs)
  }

  let cancelError
  try {
    await api.cancelPptxJob(jobId)
  } catch (err) {
    cancelError = err
  }

  try {
    const finalJob = await api.pollPptxJob(jobId)
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

export function waitForPptxJob({
  jobId,
  api,
  EventSourceImpl = globalThis.EventSource,
  onProgress,
  onConnection,
  maxPollAttempts = 120,
  pollIntervalMs = 1000,
}) {
  if (!EventSourceImpl) {
    return pollPptxJobUntilTerminal({
      jobId,
      api,
      onProgress,
      maxPollAttempts,
      pollIntervalMs,
    })
  }

  return new Promise((resolve, reject) => {
    const eventSource = new EventSourceImpl(`/api/pptx/jobs/${jobId}/stream`)
    let settled = false
    let polling = false
    onConnection?.({ es: eventSource, jobId })

    const finish = (callback, value) => {
      if (settled) return
      settled = true
      eventSource.close()
      onConnection?.(null)
      callback(value)
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
      }).then(
        (result) => finish(resolve, result),
        (err) => finish(reject, err)
      )
    }
  })
}
