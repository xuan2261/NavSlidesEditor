import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  enforcePerformanceBudget,
  validatePerformanceBudgetSchema,
} from '../../scripts/vitest/performance-budget.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const budgetPath = path.join(repoRoot, 'config', 'vitest', 'performance-budget.json')

describe('Vitest performance budget contract', () => {
  it('checks in an explicit pending budget without inventing maxWallSeconds', () => {
    const budget = JSON.parse(readFileSync(budgetPath, 'utf8'))
    expect(validatePerformanceBudgetSchema(budget)).toEqual(budget)
    expect(budget).toMatchObject({
      schemaVersion: 1,
      status: 'pending',
      maxWallSeconds: null,
      requiredSampleCount: 5,
    })
    expect(budget.sampleDurationsSeconds).toEqual([])
  })

  it('fails enforcement while the budget is pending or unset', () => {
    expect(() =>
      enforcePerformanceBudget(
        {
          schemaVersion: 1,
          status: 'pending',
          maxWallSeconds: null,
          requiredSampleCount: 5,
          sampleDurationsSeconds: [],
        },
        { wallSeconds: 1 }
      )
    ).toThrow(/pending/)
    expect(() =>
      enforcePerformanceBudget(
        { schemaVersion: 1, requiredSampleCount: 5, sampleDurationsSeconds: [] },
        { wallSeconds: 1 }
      )
    ).toThrow(/status/)
  })

  it('enforces measured wall time and subject identity', () => {
    const budget = {
      schemaVersion: 1,
      status: 'measured',
      maxWallSeconds: 120,
      requiredSampleCount: 5,
      sampleDurationsSeconds: [90, 91, 92, 93, 94],
      runnerClass: 'windows-ci-4cpu',
      inventoryHash: 'inventory-a',
      configHash: 'config-a',
      measurementCommit: 'a'.repeat(40),
      statistic: 'median-plus-bounded-margin',
      varianceMargin: 0.2,
    }
    expect(
      enforcePerformanceBudget(budget, {
        wallSeconds: 119,
        runnerClass: 'windows-ci-4cpu',
        inventoryHash: 'inventory-a',
        configHash: 'config-a',
      })
    ).toEqual(budget)
    expect(() =>
      enforcePerformanceBudget(budget, {
        wallSeconds: 121,
        runnerClass: 'windows-ci-4cpu',
        inventoryHash: 'inventory-a',
        configHash: 'config-a',
      })
    ).toThrow(/120/)
    expect(() =>
      enforcePerformanceBudget(budget, {
        wallSeconds: 100,
        runnerClass: 'windows-ci-4cpu',
        inventoryHash: 'changed',
        configHash: 'config-a',
      })
    ).toThrow(/inventoryHash/)
  })
})
