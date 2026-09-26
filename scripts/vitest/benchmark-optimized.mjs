import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  FROZEN_INVENTORY_PATH,
  buildVitestTopology,
  discoverVitestFiles,
  repoRoot,
} from '../../config/vitest/vitest-lanes.mjs'
import { enforcePerformanceBudget, validatePerformanceBudgetSchema } from './performance-budget.mjs'
import { captureFacts, hashBytes, hashFile } from './baseline-support.mjs'
import {
  assertFrozenInventory,
  buildOptimizedComparison,
  deriveMeasuredBudget,
  evaluateBudgetAuthority,
  summarizeBenchmarkRuns,
  validateBenchmarkExecution,
} from './benchmark-support.mjs'
import { runVitestSample } from './benchmark-runner.mjs'

function runnerClass(facts) {
  if (process.env.VITEST_RUNNER_CLASS) return process.env.VITEST_RUNNER_CLASS
  const memoryGb = Math.round(facts.host.totalMemoryBytes / 1024 ** 3)
  return [
    facts.host.platform,
    facts.host.arch,
    `${facts.host.logicalCpuCount}cpu`,
    `${memoryGb}gb`,
    process.env.CI ? 'ci' : 'local',
  ].join('-')
}

function currentInventory(topology) {
  const files = topology.files.map(({ path: file, sourceSha256 }) => ({
    path: file,
    sourceSha256,
  }))
  return {
    algorithm: 'sha256',
    hash: hashBytes(JSON.stringify(files)),
    fileCount: files.length,
    files,
  }
}

function defaultOutput(mode) {
  return path.join(repoRoot, '.tmp', `vitest-${mode}-benchmark.json`)
}

export async function runOptimizedBenchmark(values) {
  const mode = values.mode
  const runCount = Number(values.runs || (mode === 'ci-budget' ? 5 : 3))
  const minimum = mode === 'ci-budget' ? 5 : 3
  if (!Number.isInteger(runCount) || runCount < minimum) {
    throw new Error(`--runs must be at least ${minimum} for ${mode}`)
  }
  const facts = captureFacts()
  const configPath = path.join(repoRoot, 'vitest.config.mjs')
  const configHash = hashFile(configPath)
  const topology = buildVitestTopology({ files: discoverVitestFiles() })
  let inventory = currentInventory(topology)
  let extraArgs = []
  let frozenInventoryPath = null
  let frozenInventoryHash = null
  if (mode === 'optimized') {
    frozenInventoryPath = path.resolve(repoRoot, values.inventory || FROZEN_INVENTORY_PATH)
    const frozenReceipt = JSON.parse(readFileSync(frozenInventoryPath, 'utf8'))
    frozenInventoryHash = frozenReceipt.inventory.hash
    const frozenPaths = frozenReceipt.inventory.files.map((entry) => entry.path)
    const frozenTopology = buildVitestTopology({ files: frozenPaths })
    inventory = currentInventory(frozenTopology)
    assertFrozenInventory(frozenReceipt, inventory)
    const frozenSet = new Set(frozenPaths)
    extraArgs = topology.files
      .filter((entry) => !frozenSet.has(entry.path))
      .flatMap((entry) => ['--exclude', entry.path])
  }
  const laneByPath = new Map(topology.files.map((entry) => [entry.path, entry.lane]))
  const rawRoot = path.join(repoRoot, '.tmp', `vitest-${mode}-raw`)
  mkdirSync(rawRoot, { recursive: true })
  const runs = []
  for (let index = 1; index <= runCount; index += 1) {
    runs.push(
      await runVitestSample({
        label: `${mode}-run-${index}`,
        rawRoot,
        extraArgs,
        laneByPath,
      })
    )
  }
  const summary = summarizeBenchmarkRuns(runs)
  const executionInventory = validateBenchmarkExecution(
    runs,
    inventory.files.map((entry) => entry.path)
  )
  const subject = {
    commit: facts.commit,
    dirty: facts.dirtyStatus.length > 0,
    configPath: 'vitest.config.mjs',
    configHash,
    inventoryHash: frozenInventoryHash || inventory.hash,
    currentSourceInventoryHash: inventory.hash,
    sourceHashMatchesFrozen:
      frozenInventoryHash == null ? null : frozenInventoryHash === inventory.hash,
    inventoryFileCount: inventory.fileCount,
    frozenInventoryPath: frozenInventoryPath
      ? path.relative(repoRoot, frozenInventoryPath).replaceAll('\\', '/')
      : null,
    runnerClass: runnerClass(facts),
    versions: facts.versions,
    host: facts.host,
    browserInstallation: facts.browserInstallation,
  }
  const budgetAuthority = evaluateBudgetAuthority({
    dirty: subject.dirty,
    ciEquivalent:
      process.env.CI === 'true' || process.env.VITEST_CI_EQUIVALENT === '1',
  })
  let comparison = null
  if (mode === 'optimized') {
    const baselinePath = path.resolve(
      repoRoot,
      values.baseline ||
        'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports/vitest-baseline-attempt-2.json'
    )
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
    comparison = {
      baselinePath: path.relative(repoRoot, baselinePath).replaceAll('\\', '/'),
      ...buildOptimizedComparison(baseline, {
        medianSeconds: summary.medianSeconds,
        inventoryHash: subject.inventoryHash,
        sourceHashMatchesFrozen: subject.sourceHashMatchesFrozen,
        pendingTests: summary.maxPendingTests,
        facts,
      }),
    }
  }
  let budget = null
  if (mode === 'ci-budget') {
    if (!values.budget) throw new Error('ci-budget mode requires --budget')
    const budgetPath = path.resolve(repoRoot, values.budget)
    const configured = validatePerformanceBudgetSchema(JSON.parse(readFileSync(budgetPath, 'utf8')))
    const durations = runs.map((run) => run.durationSeconds)
    const preview =
      summary.green && executionInventory.valid
        ? deriveMeasuredBudget({
            durations,
            requiredSampleCount: configured.requiredSampleCount,
            runnerClass: subject.runnerClass,
            inventoryHash: subject.inventoryHash,
            configHash: subject.configHash,
            measurementCommit: subject.commit,
          })
        : null
    budget = {
      configured,
      authority: budgetAuthority,
      candidate: budgetAuthority.valid ? preview : null,
      preview,
      enforced: configured.status === 'measured' && budgetAuthority.valid,
    }
    if (configured.status === 'measured' && budgetAuthority.valid) {
      for (const duration of durations) {
        enforcePerformanceBudget(configured, {
          wallSeconds: duration,
          runnerClass: subject.runnerClass,
          inventoryHash: subject.inventoryHash,
          configHash: subject.configHash,
        })
      }
    }
  }
  const receipt = {
    schemaVersion: 1,
    kind: `vitest-${mode}-benchmark`,
    capturedAt: new Date().toISOString(),
    subject,
    protocol: { requestedRuns: runCount, completedRuns: runs.length, serialSamples: true },
    runs,
    ...summary,
    executionInventory,
    comparison,
    budget,
    valid:
      summary.green &&
      executionInventory.valid &&
      (comparison?.protocolCompatible ?? true) &&
      (mode !== 'ci-budget' || budgetAuthority.valid),
  }
  const outputPath = path.resolve(repoRoot, values.out || defaultOutput(mode))
  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`)
  console.log(`[vitest-benchmark] ${mode} median ${summary.medianSeconds} seconds`)
  console.log(`[vitest-benchmark] receipt ${path.relative(repoRoot, outputPath)}`)
  if (!receipt.valid) process.exitCode = 2
}
