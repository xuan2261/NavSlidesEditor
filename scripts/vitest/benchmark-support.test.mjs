import { describe, expect, it } from 'vitest'
import {
  assertFrozenInventory,
  buildOptimizedComparison,
  deriveMeasuredBudget,
  evaluateBudgetAuthority,
  summarizeBenchmarkRuns,
  validateBenchmarkExecution,
} from './benchmark-support.mjs'

describe('Vitest benchmark support', () => {
  it('requires the exact frozen paths while tracking current source hashes separately', () => {
    const receipt = {
      inventory: {
        fileCount: 2,
        hash: 'frozen-hash',
        files: [
          { path: 'client/a.test.js', sourceSha256: 'a' },
          { path: 'server/b.test.js', sourceSha256: 'b' },
        ],
      },
    }
    expect(
      assertFrozenInventory(receipt, {
        fileCount: 2,
        hash: 'current-source-hash',
        files: [
          { path: 'client/a.test.js', sourceSha256: 'changed' },
          { path: 'server/b.test.js', sourceSha256: 'b' },
        ],
      })
    ).toEqual(receipt.inventory)
    expect(() =>
      assertFrozenInventory(receipt, {
        fileCount: 2,
        hash: 'changed',
        files: [
          { path: 'client/a.test.js', sourceSha256: 'a' },
          { path: 'server/changed.test.js', sourceSha256: 'b' },
        ],
      })
    ).toThrow(/frozen inventory/i)
  })

  it('derives a bounded measured budget mechanically from five samples', () => {
    const derived = deriveMeasuredBudget({
      durations: [90, 92, 94, 96, 100],
      requiredSampleCount: 5,
      runnerClass: 'linux-x64-4cpu-16gb',
      inventoryHash: 'inventory',
      configHash: 'config',
      measurementCommit: 'a'.repeat(40),
    })
    expect(derived).toMatchObject({
      schemaVersion: 1,
      status: 'measured',
      requiredSampleCount: 5,
      sampleDurationsSeconds: [90, 92, 94, 96, 100],
      runnerClass: 'linux-x64-4cpu-16gb',
      statistic: 'median-plus-bounded-observed-margin',
    })
    expect(derived.varianceMargin).toBeGreaterThanOrEqual(0.05)
    expect(derived.varianceMargin).toBeLessThanOrEqual(0.25)
    expect(derived.maxWallSeconds).toBe(Math.ceil(94 * (1 + derived.varianceMargin)))
  })

  it('blocks measured budget authority for dirty or non-CI-equivalent subjects', () => {
    expect(evaluateBudgetAuthority({ dirty: false, ciEquivalent: true })).toEqual({
      valid: true,
      blockers: [],
    })
    expect(evaluateBudgetAuthority({ dirty: true, ciEquivalent: false })).toEqual({
      valid: false,
      blockers: ['dirty-subject', 'runner-not-ci-equivalent'],
    })
  })

  it('summarizes medians, counts, and lane durations without hiding failures', () => {
    const summary = summarizeBenchmarkRuns([
      {
        durationSeconds: 12,
        exitCode: 0,
        result: {
          readable: true,
          success: true,
          counts: { totalTests: 3, failedTests: 0, pendingTests: 1 },
          laneDurationsSeconds: { 'client-jsdom': 2 },
        },
      },
      {
        durationSeconds: 10,
        exitCode: 1,
        result: {
          readable: true,
          success: false,
          counts: { totalTests: 3, failedTests: 1, pendingTests: 1 },
          laneDurationsSeconds: { 'client-jsdom': 3 },
        },
      },
      {
        durationSeconds: 11,
        exitCode: 0,
        result: {
          readable: true,
          success: true,
          counts: { totalTests: 3, failedTests: 0, pendingTests: 1 },
          laneDurationsSeconds: { 'client-jsdom': 4 },
        },
      },
    ])
    expect(summary).toMatchObject({
      medianSeconds: 11,
      green: false,
      maxFailedTests: 1,
      maxPendingTests: 1,
    })
    expect(summary.laneMedianSeconds).toEqual({ 'client-jsdom': 3 })
  })

  it('compares optimized timing only when the frozen protocol subjects match', () => {
    const facts = {
      commit: 'a'.repeat(40),
      versions: { node: 'v22.22.0', vitest: '5.0.1' },
      host: { platform: 'linux', arch: 'x64', logicalCpuCount: 4, powerMode: 'ci' },
      browserInstallation: { entries: ['chromium-1'] },
    }
    const comparison = buildOptimizedComparison(
      {
        valid: true,
        medianSeconds: 100,
        subject: { inventoryHash: 'inventory' },
        facts,
      },
      { medianSeconds: 60, inventoryHash: 'inventory', facts }
    )
    expect(comparison).toMatchObject({
      protocolCompatible: true,
      improvementFraction: 0.4,
      targetImprovementFraction: 0.3,
      targetMet: true,
    })
    expect(
      buildOptimizedComparison(
        {
          valid: true,
          medianSeconds: 100,
          subject: { inventoryHash: 'other' },
          facts,
        },
        { medianSeconds: 60, inventoryHash: 'inventory', facts }
      ).protocolCompatible
    ).toBe(false)
  })

  it('rejects missing, duplicate, or unexpected benchmark file execution', () => {
    const validation = validateBenchmarkExecution(
      [
        { result: { executedFiles: ['a.test.js', 'a.test.js', 'extra.test.js'] } },
        { result: { executedFiles: ['a.test.js', 'b.test.js'] } },
      ],
      ['a.test.js', 'b.test.js']
    )
    expect(validation.valid).toBe(false)
    expect(validation.runs[0]).toEqual({
      missing: ['b.test.js'],
      duplicates: ['a.test.js'],
      unexpected: ['extra.test.js'],
    })
    expect(validation.runs[1]).toEqual({
      missing: [],
      duplicates: [],
      unexpected: [],
    })
  })
})
