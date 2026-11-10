export function verifySemanticBinding(binding, current) {
  const errors = []
  if (binding?.schemaVersion !== 1) errors.push('unsupported-semantic-binding-schema')
  for (const field of ['manifestDigest', 'implementationDigest', 'runnerDigest']) {
    if (!/^[a-f0-9]{64}$/.test(current[field]) || binding?.[field] !== current[field]) {
      errors.push(`semantic-binding-mismatch:${field}`)
    }
  }
  return { ok: errors.length === 0, errors }
}

export function verifyOperationResults(operations, report) {
  const errors = []
  const assertions = (report?.testResults || []).flatMap((suite) => suite.assertionResults || [])
  const passed = assertions.filter((assertion) => assertion.status === 'passed')
  const failed = assertions.filter((assertion) => assertion.status === 'failed')
  const pending = assertions.filter((assertion) =>
    ['pending', 'skipped', 'todo', 'disabled'].includes(assertion.status)
  )
  if (
    report?.success !== true ||
    assertions.length === 0 ||
    report.numTotalTests !== assertions.length ||
    report.numPassedTests !== passed.length ||
    report.numFailedTests !== failed.length ||
    report.numPendingTests !== pending.length ||
    passed.length + failed.length + pending.length !== assertions.length
  ) {
    errors.push('runner-count-mismatch')
  }
  if (failed.length || pending.length) errors.push('runner-not-all-passed')
  for (const operation of operations) {
    for (const scenario of ['edit-save-reload', 'reject-invalid']) {
      const id = `${operation.id}:${scenario}`
      const matches = assertions.filter((assertion) => assertion.title === id)
      if (matches.length !== 1 || matches[0].status !== 'passed') {
        errors.push(`missing-passed-assertion:${id}`)
      }
    }
  }
  return { ok: errors.length === 0, errors }
}
