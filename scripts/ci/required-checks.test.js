import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { REQUIRED_JOB_IDS, verifyRequiredChecks } from './required-checks.mjs'

const workflow = load(readFileSync(
  '.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml', 'utf8',
))
const summary = workflow.jobs['required-checks']
const requiredIds = REQUIRED_JOB_IDS
const allSuccess = () => Object.fromEntries(requiredIds.map((id) => [id, { result: 'success' }]))

// Execute the parsed workflow's actual Node command with its environment binding.
function runSummary(input) {
  const step = summary.steps.find((entry) => entry.run)
  const [executable, ...args] = step.run.trim().split(/\s+/)
  if (executable !== 'node') throw new Error('Required summary must execute the Node CLI')
  const json = typeof input === 'string' ? input : JSON.stringify(input)
  const env = { ...process.env, ...step.env }
  if (step.env?.NEEDS_JSON === '${{ toJSON(needs) }}') env.NEEDS_JSON = json
  if (json === undefined) delete env.NEEDS_JSON
  const result = spawnSync(process.execPath, args, {
    env, encoding: 'utf8', timeout: 10000,
  })
  if (result.error) throw result.error
  return result
}

function expectRejected(needs, id = 'lint') {
  const result = runSummary(needs)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain(id)
}

describe('required CI workflow status policy', () => {
  it('P04-01 accepts all thirteen required successes', () => {
    expect(requiredIds).toHaveLength(13)
    expect(runSummary(allSuccess()).status).toBe(0)
  })

  it.each(requiredIds)('P04-02 rejects skipped required job %s', (id) => {
    expectRejected({ ...allSuccess(), [id]: { result: 'skipped' } }, id)
  })

  it('P04-03 rejects empty needs', () => expectRejected({}))
  it.each(requiredIds)('P04-03 rejects missing required job %s', (id) => {
    const needs = allSuccess()
    delete needs[id]
    expectRejected(needs, id)
  })

  it.each(['failure', 'cancelled', 'timed_out'])('P04-04 rejects %s', (result) => {
    expectRejected({ ...allSuccess(), lint: { result } })
  })
  it.each(['unknown', 'pending', '', 'SUCCESS', null, false, 0])(
    'P04-04 rejects invalid result %s', (result) => {
      expectRejected({ ...allSuccess(), lint: { result } })
    },
  )
  it.each([null, {}, 'success', ['success']].map((entry) => [entry]))(
    'P04-05 rejects malformed job %j', (entry) => {
      expectRejected({ ...allSuccess(), lint: entry })
    },
  )

  it('P04-06 ignores a failed optional feature coverage job', () => {
    expect(runSummary({
      ...allSuccess(), 'feature-coverage-gate': { result: 'failure' },
    }).status).toBe(0)
  })
  it('P04-08 rejects build failure with dependent E2E skipped', () => {
    const needs = allSuccess()
    needs.build.result = 'failure'
    for (const id of requiredIds.filter((id) => id.startsWith('e2e-'))) {
      needs[id].result = 'skipped'
    }
    expectRejected(needs, 'build')
  })
  it('P04-09 ignores unrelated nonrequired results', () => {
    expect(runSummary({ ...allSuccess(), unrelated: { result: 'cancelled' } }).status).toBe(0)
  })
})

describe('required summary boundary and semantic inventory', () => {
  it('P04-07 matches the parsed workflow needs set without duplicates', () => {
    expect(new Set(summary.needs)).toEqual(new Set(requiredIds))
    expect(summary.needs.length).toBe(new Set(summary.needs).size)
  })

  it('P04-08 schedules the summary regardless of upstream outcomes', () => {
    expect(summary.if).toBe('always()')
  })

  it.each([null, [], 'success', 42].map((needs) => [needs]))(
    'P04-05 rejects nonobject needs %j', (needs) => {
      expect(() => verifyRequiredChecks(needs)).toThrow(/object/)
    },
  )

  it('P04-03 does not accept inherited required jobs or results', () => {
    expect(() => verifyRequiredChecks(Object.create(allSuccess()))).toThrow(/lint/)
    const needs = allSuccess()
    needs.lint = Object.create({ result: 'success' })
    expect(() => verifyRequiredChecks(needs)).toThrow(/lint/)
  })

  it('P04-05 accepts the evaluator success contract', () => {
    expect(() => verifyRequiredChecks(allSuccess())).not.toThrow()
  })

  it.each([undefined, '', '{', 'null', '[]'])('P04-05 rejects invalid CLI JSON %s', (json) => {
    const result = runSummary(json)
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/NEEDS_JSON|object/)
  })

  it('P04-05 does not echo malformed JSON payloads into diagnostics', () => {
    const result = runSummary('{"private":"not-a-real-secret"')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('NEEDS_JSON')
    expect(result.stderr).not.toContain('not-a-real-secret')
  })

  it('P04-04 treats shell metacharacters as invalid data, not commands', () => {
    expectRejected({ ...allSuccess(), lint: { result: "success'; exit 0; #" } })
  })
})
