const {
  coded,
  createDeadline,
  requestJson,
  safeServerReasonCode,
  waitWithSignal,
  withSignal,
} = require('./http-boundary')

function endpoint(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).href
}

function completedPresentationId(job) {
  return job?.status === 'done' && typeof job.result?.presentationId === 'string' && job.result.presentationId
    ? job.result.presentationId
    : null
}

function timeoutOutcome(code, jobId, presentationId = null, reasonCode = null) {
  const error = coded(code)
  const sanitizedReasonCode = safeServerReasonCode(reasonCode)
  if (sanitizedReasonCode) error.reasonCode = sanitizedReasonCode
  if (presentationId) error.cleanup = { jobId, presentationId }
  return error
}

function reconciledTimeout(jobId, presentationId) {
  return timeoutOutcome('import-job-timeout-reconciled', jobId, presentationId)
}

async function reconcileCompletedJob(fetchImpl, baseUrl, jobId, presentationId, signal) {
  const result = await requestJson(
    fetchImpl,
    endpoint(baseUrl, `/api/pptx/jobs/${encodeURIComponent(jobId)}/reconcile`),
    withSignal({ method: 'POST' }, signal)
  )
  if (result?.success !== true || result.status !== 'reconciled' || result.jobId !== jobId || result.presentationId !== presentationId) {
    throw timeoutOutcome('import-job-timeout-unreconciled', jobId, presentationId)
  }
  throw reconciledTimeout(jobId, presentationId)
}

async function cancelAndReconcileJob(fetchImpl, baseUrl, jobId, { pollIntervalMs, reconciliationAttempts, sleep, signal = null }) {
  let observedPresentationId = null
  let observedReasonCode = null
  try {
    await requestJson(fetchImpl, endpoint(baseUrl, `/api/pptx/jobs/${encodeURIComponent(jobId)}`), withSignal({ method: 'DELETE' }, signal))
  } catch {
    // A completed or in-memory-expired job can reject cancellation; inspect its durable receipt below.
  }
  for (let attempt = 0; attempt < reconciliationAttempts; attempt += 1) {
    let job
    try { job = await requestJson(fetchImpl, endpoint(baseUrl, `/api/pptx/jobs/${encodeURIComponent(jobId)}`), withSignal(null, signal)) } catch {
      if (signal?.aborted) break
      if (attempt + 1 < reconciliationAttempts) {
        await waitWithSignal(sleep, pollIntervalMs, signal)
        continue
      }
      break
    }
    const presentationId = completedPresentationId(job)
    if (presentationId) {
      observedPresentationId = presentationId
      try { await reconcileCompletedJob(fetchImpl, baseUrl, jobId, presentationId, signal) } catch (error) {
        if (error?.code === 'import-job-timeout-reconciled') throw error
        observedReasonCode = safeServerReasonCode(error?.reasonCode) || observedReasonCode
      }
    }
    if (['failed', 'cancelled'].includes(job?.status)) throw coded('import-job-timeout-cancelled')
    if (attempt + 1 < reconciliationAttempts) {
      try { await waitWithSignal(sleep, pollIntervalMs, signal) } catch { break }
    }
  }
  throw timeoutOutcome('import-job-timeout-unreconciled', jobId, observedPresentationId, observedReasonCode)
}

async function reconcileTimedOutJob(fetchImpl, baseUrl, jobId, options) {
  const deadline = createDeadline(options.reconciliationTimeoutMs)
  try {
    return await cancelAndReconcileJob(fetchImpl, baseUrl, jobId, { ...options, signal: deadline.signal })
  } finally {
    deadline.clear()
  }
}

async function waitForCompletedJob(fetchImpl, baseUrl, jobId, {
  pollIntervalMs, timeoutMs, reconciliationAttempts = 40, reconciliationTimeoutMs = 30_000, signal = null, sleep,
}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) throw coded('invalid-job-timeout')
  const ownedDeadline = signal ? null : createDeadline(timeoutMs)
  const activeSignal = signal || ownedDeadline.signal
  const deadline = Date.now() + timeoutMs
  try {
    while (!activeSignal.aborted && Date.now() <= deadline) {
      let job
      try { job = await requestJson(fetchImpl, endpoint(baseUrl, `/api/pptx/jobs/${encodeURIComponent(jobId)}`), withSignal(null, activeSignal)) } catch {
        return reconcileTimedOutJob(fetchImpl, baseUrl, jobId, { pollIntervalMs, reconciliationAttempts, reconciliationTimeoutMs, sleep })
      }
      const presentationId = completedPresentationId(job)
      if (presentationId) return presentationId
      if (['failed', 'cancelled'].includes(job?.status)) throw coded('import-job-failed')
      try { await waitWithSignal(sleep, pollIntervalMs, activeSignal) } catch {
        return reconcileTimedOutJob(fetchImpl, baseUrl, jobId, { pollIntervalMs, reconciliationAttempts, reconciliationTimeoutMs, sleep })
      }
    }
    return reconcileTimedOutJob(fetchImpl, baseUrl, jobId, { pollIntervalMs, reconciliationAttempts, reconciliationTimeoutMs, sleep })
  } finally {
    ownedDeadline?.clear()
  }
}

module.exports = { cancelAndReconcileJob, waitForCompletedJob }
