const TRANSACTION_STATES = Object.freeze([
  'requested', 'leased', 'staged', 'validated', 'committing', 'committed',
])
const CANCELLATION_POINTS = Object.freeze(['cancellable', 'committing', 'committed'])

function transitionExportJob(job, transactionState) {
  const current = TRANSACTION_STATES.indexOf(job.transactionState)
  const next = TRANSACTION_STATES.indexOf(transactionState)
  if (next < 0 || (current >= 0 && next !== current + 1)) {
    throw new Error(`Invalid export transaction transition: ${job.transactionState} -> ${transactionState}`)
  }
  const cancellationPoint = next < 4 ? 'cancellable' : transactionState
  return Object.freeze({ ...job, transactionState, cancellationPoint })
}

function cancellationOutcome(job) {
  if (job.cancellationPoint === 'cancellable') {
    return Object.freeze({ accepted: true, outcome: 'cancelled' })
  }
  return Object.freeze({
    accepted: false,
    outcome: job.cancellationPoint === 'committed' ? 'committed' : 'commit-in-progress',
  })
}

module.exports = {
  CANCELLATION_POINTS,
  TRANSACTION_STATES,
  cancellationOutcome,
  transitionExportJob,
}
