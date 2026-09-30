import { describe, expect, it } from 'vitest'
import {
  COVERAGE_FLOORS,
  assertCoverageSummary,
  buildCoverageSummary,
  mergeProjectCoverage,
  summarizeCoverage,
} from '../../scripts/vitest/coverage-results.mjs'
import { mergeVitestResults } from '../../scripts/vitest/run-results.mjs'

function coverageFile(file, hits) {
  return {
    path: file,
    statementMap: {
      0: { start: { line: 1, column: 0 }, end: { line: 1, column: 5 } },
      1: { start: { line: 2, column: 0 }, end: { line: 2, column: 5 } },
    },
    fnMap: { 0: { name: 'owned', decl: {}, loc: {}, line: 1 } },
    branchMap: { 0: { line: 1, type: 'if', locations: [{}, {}] } },
    s: { 0: hits, 1: 0 },
    f: { 0: hits },
    b: { 0: [hits, 0] },
  }
}

describe('Vitest merged coverage contract', () => {
  it('merges all projects by source file without overwriting counters', () => {
    const file = 'C:/repo/shared/src/example.js'
    const merged = mergeProjectCoverage(
      [
        { projectName: 'client-jsdom', coverageMap: { [file]: coverageFile(file, 1) } },
        { projectName: 'node-parallel', coverageMap: { [file]: coverageFile(file, 2) } },
        {
          projectName: 'node-serial',
          coverageMap: { 'C:/repo/server/serial.js': coverageFile('C:/repo/server/serial.js', 1) },
        },
      ],
      ['client-jsdom', 'node-parallel', 'node-serial']
    )
    const shared = Object.values(merged).find((record) =>
      record.path.endsWith('/shared/src/example.js')
    )
    expect(shared.s).toEqual({ 0: 3, 1: 0 })
    expect(shared.f).toEqual({ 0: 3 })
    expect(shared.b).toEqual({ 0: [3, 0] })
    expect(Object.keys(merged)).toHaveLength(2)
    const summary = buildCoverageSummary(merged)
    expect(summary.total.statements.total).toBe(4)
    expect(Object.keys(summary).some((key) => key.endsWith('/server/serial.js'))).toBe(true)
  })

  it('preserves the established 74/60/68/71 floors and fails below them', () => {
    expect(COVERAGE_FLOORS).toEqual({
      lines: 74,
      branches: 60,
      functions: 68,
      statements: 71,
    })
    const passing = {
      lines: { pct: 74 },
      branches: { pct: 60 },
      functions: { pct: 68 },
      statements: { pct: 71 },
    }
    expect(assertCoverageSummary(passing)).toEqual(passing)
    expect(() => assertCoverageSummary({ ...passing, branches: { pct: 59.99 } })).toThrow(
      /branches/
    )
    expect(summarizeCoverage({ 'C:/repo/a.js': coverageFile('C:/repo/a.js', 1) })).toMatchObject({
      lines: { total: 2, covered: 1, pct: 50 },
    })
  })

  it('rejects a missing project and structurally incompatible duplicate map', () => {
    const file = 'C:/repo/a.js'
    expect(() =>
      mergeProjectCoverage(
        [{ projectName: 'client-jsdom', coverageMap: {} }],
        ['client-jsdom', 'node-parallel']
      )
    ).toThrow(/node-parallel/)
    const changed = coverageFile(file, 1)
    changed.statementMap[0].start.line = 9
    expect(() =>
      mergeProjectCoverage([
        { projectName: 'one', coverageMap: { [file]: coverageFile(file, 1) } },
        { projectName: 'two', coverageMap: { [file]: changed } },
      ])
    ).toThrow(/incompatible/)
  })
})

describe('Vitest merged result contract', () => {
  it('preserves testResult and assertion fields across project reports', () => {
    const assertion = {
      ancestorTitles: ['suite'],
      fullName: 'suite keeps metadata',
      title: 'keeps metadata',
      status: 'passed',
      duration: 4,
      failureMessages: [],
      meta: { capability: 'result-contract' },
      tags: ['fast'],
    }
    const report = (projectName, name) => ({
      projectName,
      result: {
        numTotalTestSuites: 1,
        numPassedTestSuites: 1,
        numFailedTestSuites: 0,
        numPendingTestSuites: 0,
        numTotalTests: 1,
        numPassedTests: 1,
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
        success: true,
        testResults: [{ name, status: 'passed', message: '', assertionResults: [assertion] }],
      },
    })
    const merged = mergeVitestResults([
      report('client-jsdom', 'C:/repo/client/a.test.js'),
      report('node-parallel', 'C:/repo/shared/b.test.js'),
    ])
    expect(merged.testResults).toHaveLength(2)
    expect(merged.testResults[0].assertionResults[0]).toEqual(assertion)
    expect(merged).toMatchObject({ numTotalTests: 2, numPassedTests: 2, success: true })
  })

  it('rejects duplicate execution of the same test file', () => {
    const result = {
      success: true,
      testResults: [{ name: 'C:\\repo\\same.test.js', assertionResults: [] }],
    }
    expect(() =>
      mergeVitestResults([
        { projectName: 'one', result },
        { projectName: 'two', result: { ...result, testResults: [{ ...result.testResults[0] }] } },
      ])
    ).toThrow(/duplicate/i)
  })
})
