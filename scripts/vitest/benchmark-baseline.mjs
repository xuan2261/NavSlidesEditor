import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  captureFacts,
  captureSourceFingerprint,
  captureTestInventory,
  hashFile,
  repoRoot,
} from './baseline-support.mjs'
import { runVitestSample } from './benchmark-runner.mjs'

export async function runBaselineBenchmark(values) {
  if (!values.config || !values.inventory) {
    throw new Error('Baseline mode requires --config and --inventory')
  }
  const runCount = Number(values.runs || 3)
  if (!Number.isInteger(runCount) || runCount < 3) throw new Error('--runs must be at least 3')
  if (values.attempt && !/^[a-z0-9-]+$/.test(values.attempt)) {
    throw new Error('--attempt must contain only lowercase letters, digits, and hyphens')
  }
  const configPath = path.resolve(repoRoot, values.config)
  const inventoryPath = path.resolve(repoRoot, values.inventory)
  const inventoryReceipt = JSON.parse(readFileSync(inventoryPath, 'utf8'))
  const reportsRoot = path.join(
    repoRoot,
    'plans/260925-0631-single-user-powerpoint-native-fidelity-release-deep-tdd/reports'
  )
  const baselineName = values.attempt ? `vitest-baseline-${values.attempt}` : 'vitest-baseline'
  const rawRoot = path.join(reportsRoot, `${baselineName}-raw`)
  const inventoryName = values.attempt
    ? `vitest-legacy-inventory-${values.attempt}.json`
    : 'vitest-legacy-inventory.json'
  const receiptPath = path.join(reportsRoot, `${baselineName}.json`)
  mkdirSync(rawRoot, { recursive: true })
  writeFileSync(
    path.join(reportsRoot, inventoryName),
    `${JSON.stringify(inventoryReceipt, null, 2)}\n`
  )

  const facts = captureFacts()
  const initialSource = captureSourceFingerprint()
  const initialInventory = captureTestInventory()
  const expectedInventory = inventoryReceipt.inventory
  const configSha256 = hashFile(configPath)
  let stable =
    initialSource.hash === inventoryReceipt.sourceFingerprint.hash &&
    initialInventory.hash === expectedInventory.hash &&
    configSha256 === inventoryReceipt.config.sha256
  const runs = []
  for (let index = 1; index <= runCount && stable; index += 1) {
    runs.push(
      await runVitestSample({
        label: `full-suite-run-${index}`,
        rawRoot,
        extraArgs: ['--config', configPath],
        laneByPath: new Map(),
      })
    )
    stable =
      captureSourceFingerprint().hash === initialSource.hash &&
      captureTestInventory().hash === initialInventory.hash &&
      hashFile(configPath) === configSha256
  }
  const fullRunsGreen =
    runs.length === runCount &&
    runs.every(
      (run) => run.exitCode === 0 && run.result?.readable && run.result.counts.failedTests === 0
    )
  let coverage = {
    run: false,
    reason: stable ? 'one or more full-suite samples failed' : 'capture subject changed',
  }
  if (stable && fullRunsGreen) {
    const coverageRoot = path.join(rawRoot, 'coverage')
    coverage = await runVitestSample({
      label: 'coverage-run',
      rawRoot,
      extraArgs: [
        '--config',
        configPath,
        '--coverage',
        `--coverage.reportsDirectory=${coverageRoot}`,
      ],
      laneByPath: new Map(),
    })
    const summaryPath = path.join(coverageRoot, 'coverage-summary.json')
    if (existsSync(summaryPath)) {
      const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
      coverage.coverageSummary = summary.total || null
    }
  }
  const durations = runs.map((run) => run.durationSeconds).sort((a, b) => a - b)
  const medianSeconds =
    runs.length === runCount ? (durations[Math.floor(durations.length / 2)] ?? null) : null
  const allCommandsGreen =
    fullRunsGreen && coverage?.exitCode === 0 && coverage?.result?.counts?.failedTests === 0
  const captureIntegrityValid =
    stable &&
    runs.length === runCount &&
    runs.every((run) => run.result?.readable) &&
    coverage?.result?.readable
  const receipt = {
    schemaVersion: 1,
    kind: 'vitest-pre-red-legacy-baseline',
    capturedAt: new Date().toISOString(),
    facts,
    subject: {
      commit: facts.commit,
      dirty: facts.dirtyStatus.length > 0,
      configPath: path.relative(repoRoot, configPath).replaceAll('\\', '/'),
      configSha256,
      sourceConfigSha256: inventoryReceipt.config.sourceSha256,
      inventoryHash: initialInventory.hash,
      inventoryFileCount: initialInventory.fileCount,
      sourceFingerprint: initialSource,
      thresholds: { lines: 74, branches: 60, functions: 68, statements: 71 },
    },
    protocol: {
      serial: true,
      requestedFullSuiteRuns: runCount,
      completedFullSuiteRuns: runs.length,
      requestedCoverageRuns: 1,
      completedCoverageRuns: coverage.exitCode == null ? 0 : 1,
    },
    runs,
    medianSeconds,
    coverage,
    captureIntegrityValid,
    testBaselineGreen: allCommandsGreen,
    valid: captureIntegrityValid && allCommandsGreen,
    invalidReason: !stable
      ? 'source, test inventory, or frozen config changed during capture'
      : !fullRunsGreen
        ? 'one or more full-suite samples failed'
        : allCommandsGreen
          ? null
          : 'coverage run failed',
    frozenBy: `${baselineName}.sha256`,
  }
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  const sidecar = path.join(reportsRoot, `${baselineName}.sha256`)
  writeFileSync(sidecar, `${hashFile(receiptPath)}  ${baselineName}.json\n`)
  console.log(`[vitest-benchmark] median ${medianSeconds ?? 'n/a'} seconds`)
  console.log(`[vitest-benchmark] capture integrity ${captureIntegrityValid}`)
  console.log(`[vitest-benchmark] tests green ${allCommandsGreen}`)
  if (!receipt.valid) process.exitCode = 2
}
