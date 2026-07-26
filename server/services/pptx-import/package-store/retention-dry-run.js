/**
 * Package-store retention dry-run (default-off, non-destructive).
 * Phase 6 scaffolding: eligibility report only; never mutates StateStore/WAL.
 */

const DEFAULT_POLICY = Object.freeze({
  maxJobAgeMs: 30 * 24 * 60 * 60 * 1000,
  maxJobCount: 500,
  protectActiveHeads: true,
  protectOutbox: true,
  protectDeadLetter: true,
})

function parseIsoMs(value) {
  if (typeof value !== 'string' || !value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function isProtectedJob(job, state, policy = DEFAULT_POLICY) {
  if (!job || typeof job !== 'object') return true
  if (policy.protectActiveHeads && Array.isArray(state.heads)) {
    if (state.heads.some((head) => head.presentationId === job.presentationId)) return true
  }
  if (policy.protectOutbox && Array.isArray(state.compatibilityOutbox)) {
    if (state.compatibilityOutbox.some((item) => item.presentationId === job.presentationId)) {
      return true
    }
  }
  if (policy.protectDeadLetter && Array.isArray(state.compatibilityDeadLetter)) {
    if (state.compatibilityDeadLetter.some((item) =>
      item.presentationId === job.presentationId || item.write?.presentationId === job.presentationId
    )) {
      return true
    }
  }
  if (job.reconcileRequired === true) return true
  if (job.transactionState === 'apply-pending' || job.transactionState === 'applied-unacked') {
    return true
  }
  if (job.status === 'queued' || job.status === 'running') return true
  return false
}

/**
 * @returns {{ dryRun: true, policy, examined, eligible, protected, reasons }}
 */
function dryRunJobRetention(state, nowMs = Date.now(), policy = DEFAULT_POLICY) {
  const jobs = Array.isArray(state?.jobs) ? state.jobs : []
  const eligible = []
  const protectedJobs = []
  const reasons = []

  // Age eligibility
  for (const job of jobs) {
    if (isProtectedJob(job, state, policy)) {
      protectedJobs.push(job.id)
      reasons.push({ id: job.id, reason: 'protected-reference' })
      continue
    }
    const updatedMs = parseIsoMs(job.updatedAt) ?? parseIsoMs(job.terminalAt)
    if (updatedMs != null && nowMs - updatedMs > policy.maxJobAgeMs) {
      eligible.push(job.id)
      reasons.push({ id: job.id, reason: 'age-exceeded' })
    }
  }

  // Count eligibility (oldest unprotected terminal jobs beyond maxJobCount)
  if (jobs.length > policy.maxJobCount) {
    const candidates = jobs
      .filter((job) => !protectedJobs.includes(job.id) && !eligible.includes(job.id))
      .slice()
      .sort((a, b) => (parseIsoMs(a.updatedAt) || 0) - (parseIsoMs(b.updatedAt) || 0))
    const overflow = jobs.length - policy.maxJobCount
    for (let i = 0; i < overflow && i < candidates.length; i += 1) {
      const job = candidates[i]
      if (isProtectedJob(job, state, policy)) {
        protectedJobs.push(job.id)
        reasons.push({ id: job.id, reason: 'protected-reference' })
        continue
      }
      eligible.push(job.id)
      reasons.push({ id: job.id, reason: 'count-exceeded' })
    }
  }

  return {
    dryRun: true,
    policy: { ...policy },
    examined: jobs.length,
    eligible: [...new Set(eligible)],
    protected: [...new Set(protectedJobs)],
    reasons,
    destructiveEnabled: false,
  }
}

module.exports = {
  DEFAULT_POLICY,
  dryRunJobRetention,
  isProtectedJob,
}
