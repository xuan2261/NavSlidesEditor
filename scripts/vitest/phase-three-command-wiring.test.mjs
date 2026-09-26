import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const workflow = readFileSync(
  path.join(
    repoRoot,
    '.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml'
  ),
  'utf8'
)
const qualityWorkflow = readFileSync(
  path.join(repoRoot, '.github/workflows/reusable-ci-quality.yml'),
  'utf8'
)
const benchmarkRunner = readFileSync(
  path.join(repoRoot, 'scripts', 'vitest', 'benchmark-runner.mjs'),
  'utf8'
)

describe('Phase 3 command wiring', () => {
  it('guards full test and coverage commands with the inventory wrapper', () => {
    expect(packageJson.scripts.test).toBe('node scripts/vitest/run-vitest-suite.mjs')
    expect(packageJson.scripts['test:coverage']).toBe(
      'node scripts/vitest/run-vitest-suite.mjs --coverage'
    )
    expect(packageJson.scripts['test:inventory']).toBe(
      'node scripts/vitest/build-test-inventory.mjs'
    )
  })

  it('exposes benchmark, CI-budget, and canonical feature-result commands', () => {
    expect(packageJson.scripts['test:benchmark']).toMatch(/--mode optimized --runs 3/)
    expect(packageJson.scripts['test:ci-budget']).toMatch(/--mode ci-budget --runs 5/)
    expect(packageJson.scripts['test:feature-inventory']).toBe(
      'node scripts/vitest/run-project-results.mjs --out scripts/feature-inventory/run-results-vitest.json'
    )
  })

  it('uses supported package commands in CI instead of direct multi-project JSON', () => {
    const ci = `${workflow}\n${qualityWorkflow}`
    expect(ci).toContain('run: npm run test:coverage')
    expect(ci).toContain('run: npm run test:feature-inventory')
    expect(ci).toContain('run: npm run test:ci-budget')
    expect(ci).not.toContain(
      'npx vitest run --reporter=json --outputFile=scripts/feature-inventory/run-results-vitest.json'
    )
  })

  it('removes stale raw benchmark reports before every sample', () => {
    expect(benchmarkRunner).toContain('rmSync(jsonPath, { force: true })')
    expect(benchmarkRunner).toContain('rmSync(stdoutPath, { force: true })')
    expect(benchmarkRunner).toContain('rmSync(stderrPath, { force: true })')
  })
})
