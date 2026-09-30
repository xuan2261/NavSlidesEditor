function median(values) {
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.floor(ordered.length / 2)] ?? null
}

export function assertFrozenInventory(receipt, current) {
  const frozen = receipt?.inventory
  const frozenPaths = frozen?.files?.map((entry) => entry.path)
  const currentPaths = current?.files?.map((entry) => entry.path)
  const samePaths = JSON.stringify(frozenPaths) === JSON.stringify(currentPaths)
  if (!frozen || frozen.fileCount !== current?.fileCount || !samePaths) {
    throw new Error('current frozen inventory differs from the supplied frozen inventory')
  }
  return frozen
}

export function deriveMeasuredBudget({
  durations,
  requiredSampleCount,
  runnerClass,
  inventoryHash,
  configHash,
  measurementCommit,
}) {
  if (!Number.isInteger(requiredSampleCount) || durations.length < requiredSampleCount) {
    throw new Error(`at least ${requiredSampleCount} samples are required`)
  }
  const sampleMedian = median(durations)
  const observedMargin = (Math.max(...durations) - sampleMedian) / sampleMedian
  if (observedMargin > 0.25) {
    throw new Error(`observed variance margin ${observedMargin} exceeds 0.25`)
  }
  const varianceMargin = Number(Math.max(0.05, observedMargin).toFixed(6))
  return {
    schemaVersion: 1,
    kind: 'vitest-ci-wall-clock-budget',
    status: 'measured',
    requiredSampleCount,
    maxWallSeconds: Math.ceil(sampleMedian * (1 + varianceMargin)),
    sampleDurationsSeconds: durations,
    runnerClass,
    inventoryHash,
    configHash,
    measurementCommit,
    statistic: 'median-plus-bounded-observed-margin',
    varianceMargin,
  }
}

export function evaluateBudgetAuthority({ dirty, ciEquivalent }) {
  const blockers = []
  if (dirty) blockers.push('dirty-subject')
  if (!ciEquivalent) blockers.push('runner-not-ci-equivalent')
  return { valid: blockers.length === 0, blockers }
}

export function summarizeBenchmarkRuns(runs) {
  const durations = runs.map((run) => run.durationSeconds)
  const laneNames = new Set(
    runs.flatMap((run) => Object.keys(run.result?.laneDurationsSeconds || {}))
  )
  const laneMedianSeconds = {}
  for (const lane of [...laneNames].sort()) {
    laneMedianSeconds[lane] = median(
      runs.map((run) => run.result?.laneDurationsSeconds?.[lane]).filter(Number.isFinite)
    )
  }
  return {
    medianSeconds: median(durations),
    green: runs.every(
      (run) =>
        run.exitCode === 0 &&
        run.result?.readable &&
        run.result?.success &&
        run.result?.counts?.failedTests === 0
    ),
    maxFailedTests: Math.max(...runs.map((run) => run.result?.counts?.failedTests || 0)),
    maxPendingTests: Math.max(...runs.map((run) => run.result?.counts?.pendingTests || 0)),
    laneMedianSeconds,
  }
}

export function buildOptimizedComparison(baseline, optimized) {
  const baselinePendingTests = Math.max(
    0,
    ...(baseline?.runs || []).map((run) => run.result?.counts?.pendingTests || 0)
  )
  const checks = {
    baselineValid: baseline?.valid === true,
    inventoryHash: baseline?.subject?.inventoryHash === optimized.inventoryHash,
    sourceInventory: optimized.sourceHashMatchesFrozen !== false,
    commit: baseline?.facts?.commit === optimized.facts?.commit,
    nodeVersion: baseline?.facts?.versions?.node === optimized.facts?.versions?.node,
    vitestVersion: baseline?.facts?.versions?.vitest === optimized.facts?.versions?.vitest,
    host:
      JSON.stringify({
        platform: baseline?.facts?.host?.platform,
        arch: baseline?.facts?.host?.arch,
        logicalCpuCount: baseline?.facts?.host?.logicalCpuCount,
        powerMode: baseline?.facts?.host?.powerMode,
      }) ===
      JSON.stringify({
        platform: optimized.facts?.host?.platform,
        arch: optimized.facts?.host?.arch,
        logicalCpuCount: optimized.facts?.host?.logicalCpuCount,
        powerMode: optimized.facts?.host?.powerMode,
      }),
    browsers:
      JSON.stringify(baseline?.facts?.browserInstallation?.entries || []) ===
      JSON.stringify(optimized.facts?.browserInstallation?.entries || []),
    pendingTests: (optimized.pendingTests || 0) <= baselinePendingTests,
  }
  const baselineMedianSeconds = baseline?.medianSeconds
  const optimizedMedianSeconds = optimized.medianSeconds
  const improvementFraction =
    Number.isFinite(baselineMedianSeconds) && baselineMedianSeconds > 0
      ? Number(
          ((baselineMedianSeconds - optimizedMedianSeconds) / baselineMedianSeconds).toFixed(6)
        )
      : null
  return {
    baselineMedianSeconds,
    optimizedMedianSeconds,
    improvementFraction,
    targetImprovementFraction: 0.3,
    targetMet: improvementFraction != null && improvementFraction >= 0.3,
    baselinePendingTests,
    optimizedPendingTests: optimized.pendingTests || 0,
    checks,
    protocolCompatible: Object.values(checks).every(Boolean),
  }
}

export function validateBenchmarkExecution(runs, expectedPaths) {
  const expected = new Set(expectedPaths)
  const validations = runs.map((run) => {
    const counts = new Map()
    for (const file of run.result?.executedFiles || []) {
      counts.set(file, (counts.get(file) || 0) + 1)
    }
    return {
      missing: expectedPaths.filter((file) => !counts.has(file)).sort(),
      duplicates: [...counts]
        .filter(([, count]) => count > 1)
        .map(([file]) => file)
        .sort(),
      unexpected: [...counts.keys()].filter((file) => !expected.has(file)).sort(),
    }
  })
  return {
    valid: validations.every((run) => Object.values(run).every((files) => files.length === 0)),
    runs: validations,
  }
}
