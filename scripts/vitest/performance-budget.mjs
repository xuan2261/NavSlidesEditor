const PENDING_FIELDS = [
  'maxWallSeconds',
  'runnerClass',
  'inventoryHash',
  'configHash',
  'measurementCommit',
  'statistic',
  'varianceMargin',
]

function requirePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive`)
}

export function validatePerformanceBudgetSchema(budget) {
  if (!budget || budget.schemaVersion !== 1)
    throw new Error('unsupported performance budget schema')
  if (!Number.isInteger(budget.requiredSampleCount) || budget.requiredSampleCount < 5) {
    throw new Error('requiredSampleCount must be at least 5')
  }
  if (!Array.isArray(budget.sampleDurationsSeconds)) {
    throw new Error('sampleDurationsSeconds must be an array')
  }
  if (budget.status === 'pending') {
    if (budget.sampleDurationsSeconds.length !== 0) {
      throw new Error('pending budget cannot contain samples')
    }
    for (const field of PENDING_FIELDS) {
      if (budget[field] !== null && budget[field] !== undefined) {
        throw new Error(`pending budget must leave ${field} unset`)
      }
    }
    return budget
  }
  if (budget.status !== 'measured') throw new Error('status must be pending or measured')
  requirePositive(budget.maxWallSeconds, 'maxWallSeconds')
  if (budget.sampleDurationsSeconds.length < budget.requiredSampleCount) {
    throw new Error('measured budget has too few samples')
  }
  budget.sampleDurationsSeconds.forEach((sample) => requirePositive(sample, 'sample duration'))
  for (const field of ['runnerClass', 'inventoryHash', 'configHash', 'statistic']) {
    if (typeof budget[field] !== 'string' || !budget[field]) throw new Error(`${field} is required`)
  }
  if (!/^[a-f0-9]{40}$/i.test(budget.measurementCommit || '')) {
    throw new Error('measurementCommit must be a full commit SHA')
  }
  if (
    !Number.isFinite(budget.varianceMargin) ||
    budget.varianceMargin < 0 ||
    budget.varianceMargin > 1
  ) {
    throw new Error('varianceMargin must be between 0 and 1')
  }
  return budget
}

export function enforcePerformanceBudget(budget, actual) {
  validatePerformanceBudgetSchema(budget)
  if (budget.status === 'pending') {
    throw new Error('performance budget is pending measured optimized/CI samples')
  }
  requirePositive(actual?.wallSeconds, 'wallSeconds')
  for (const field of ['runnerClass', 'inventoryHash', 'configHash']) {
    if (actual[field] !== budget[field]) {
      throw new Error(`${field} differs from measured performance budget`)
    }
  }
  if (actual.wallSeconds > budget.maxWallSeconds) {
    throw new Error(`wall time ${actual.wallSeconds}s exceeds ${budget.maxWallSeconds}s`)
  }
  return budget
}
