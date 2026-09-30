import { describe, expect, it } from 'vitest'
import { evaluatePerformanceBudget } from './performance-budget.mjs'

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
  it('blocks a pending budget even when five CI samples succeeded', () => {
    const runs = Array.from({ length: 5 }, (_, index) =>
      actualRun({ label: `ci-budget-run-${index + 1}` })
    )

    expect(evaluatePerformanceBudget(pendingBudget, runs)).toMatchObject({
      valid: false,
      enforced: false,
    })
  })

  it('accepts measured samples only when all runner, inventory, config and times match', () => {
    const runs = Array.from({ length: 5 }, (_, index) =>
      actualRun({ label: `ci-budget-run-${index + 1}` })
    )

    expect(evaluatePerformanceBudget(measuredBudget(), runs)).toEqual({
      valid: true,
      enforced: true,
      blockers: [],
    })
  })

  it.each([
    ['runnerClass', { runnerClass: 'linux-x64-8cpu-32gb-ci' }],
    ['inventoryHash', { inventoryHash: 'changed-inventory' }],
    ['configHash', { configHash: 'changed-config' }],
    ['wall time', { wallSeconds: 101 }],
  ])('rejects measured %s mismatches for the exact failed sample', (_label, change) => {
    const runs = Array.from({ length: 5 }, (_, index) =>
      actualRun({ label: `ci-budget-run-${index + 1}`, ...(index === 0 ? change : {}) })
    )

    expect(evaluatePerformanceBudget(measuredBudget(), runs)).toMatchObject({
      valid: false,
      enforced: true,
      blockers: [{ sample: 'ci-budget-run-1' }],
    })
  })
})
