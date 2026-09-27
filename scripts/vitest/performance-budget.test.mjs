import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { evaluatePerformanceBudget } from './performance-budget.mjs'
import { writeBenchmarkReceipt } from './benchmark-optimized.mjs'

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createReceiptPath() {
  const directory = mkdtempSync(join(tmpdir(), 'vitest-performance-budget-'))
  temporaryDirectories.push(directory)
  return join(directory, 'receipt.json')
}

function actualRun(overrides = {}) {
  return {
    label: 'ci-budget-run-1',
    wallSeconds: 90,
    runnerClass: 'linux-x64-4cpu-16gb-ci',
    inventoryHash: 'inventory-hash',
    configHash: 'config-hash',
    ...overrides,
  }
}

function measuredBudget() {
  return {
    schemaVersion: 1,
    kind: 'vitest-ci-wall-clock-budget',
    status: 'measured',
    requiredSampleCount: 5,
    maxWallSeconds: 100,
    sampleDurationsSeconds: [88, 89, 90, 91, 92],
    runnerClass: 'linux-x64-4cpu-16gb-ci',
    inventoryHash: 'inventory-hash',
    configHash: 'config-hash',
    measurementCommit: 'a'.repeat(40),
    statistic: 'median-plus-bounded-observed-margin',
    varianceMargin: 0.05,
  }
}

const pendingBudget = {
  schemaVersion: 1,
  kind: 'vitest-ci-wall-clock-budget',
  status: 'pending',
  requiredSampleCount: 5,
  sampleDurationsSeconds: [],
  maxWallSeconds: null,
  runnerClass: null,
  inventoryHash: null,
  configHash: null,
  measurementCommit: null,
  statistic: null,
  varianceMargin: null,
}

describe('CI performance budget gate', () => {
  it('writes the five-sample receipt before returning failure for a pending budget', () => {
    const runs = Array.from({ length: 5 }, (_, index) =>
      actualRun({ label: `ci-budget-run-${index + 1}` })
    )
    const evaluation = evaluatePerformanceBudget(pendingBudget, runs)
    const receipt = {
      schemaVersion: 1,
      kind: 'vitest-ci-budget-benchmark',
      protocol: { requestedRuns: 5, completedRuns: 5, serialSamples: true },
      runs,
      budget: { configured: pendingBudget, ...evaluation },
      valid: evaluation.valid,
    }
    const outputPath = createReceiptPath()

    const exitCode = writeBenchmarkReceipt(outputPath, receipt)

    expect(exitCode).toBe(2)
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(receipt)
    expect(receipt.budget).toMatchObject({
      valid: false,
      enforced: false,
      blockers: [{ reason: 'performance budget is pending measured optimized/CI samples' }],
    })
  })

  it('passes measured samples only when runner, inventory, config, and timing match', () => {
    const budget = measuredBudget()
    const runs = Array.from({ length: 5 }, (_, index) =>
      actualRun({ label: `ci-budget-run-${index + 1}` })
    )
    const evaluation = evaluatePerformanceBudget(budget, runs)
    const receipt = { runs, budget: { configured: budget, ...evaluation }, valid: evaluation.valid }
    const outputPath = createReceiptPath()

    expect(evaluation).toEqual({ valid: true, enforced: true, blockers: [] })
    expect(writeBenchmarkReceipt(outputPath, receipt)).toBe(0)
    expect(JSON.parse(readFileSync(outputPath, 'utf8')).valid).toBe(true)
  })

  it.each([
    ['runnerClass', { runnerClass: 'linux-x64-8cpu-32gb-ci' }, 'runnerClass differs'],
    ['inventoryHash', { inventoryHash: 'changed-inventory' }, 'inventoryHash differs'],
    ['configHash', { configHash: 'changed-config' }, 'configHash differs'],
    ['wall time', { wallSeconds: 101 }, 'wall time 101s exceeds 100s'],
  ])('rejects measured %s mismatches', (_label, change, reason) => {
    const budget = measuredBudget()
    const runs = Array.from({ length: 5 }, (_, index) =>
      actualRun({ label: `ci-budget-run-${index + 1}`, ...(index === 0 ? change : {}) })
    )
    const evaluation = evaluatePerformanceBudget(budget, runs)
    const receipt = { runs, budget: { configured: budget, ...evaluation }, valid: evaluation.valid }
    const outputPath = createReceiptPath()

    expect(evaluation.valid).toBe(false)
    expect(evaluation.enforced).toBe(true)
    expect(evaluation.blockers).toEqual([{ sample: 'ci-budget-run-1', reason }])
    expect(writeBenchmarkReceipt(outputPath, receipt)).toBe(2)
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toEqual(receipt)
  })
})
