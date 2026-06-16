import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('e2e suite is sleep-free', () => {
  it('contains zero waitForTimeout calls', () => {
    const result = spawnSync('git', ['grep', '-c', 'waitForTimeout(', 'tests/e2e/'], {
      encoding: 'utf8',
    })
    const total = result.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => Number.parseInt(line.split(':').pop(), 10))
      .reduce((a, b) => a + b, 0)

    expect(total).toBe(0)
  })

  it('contains no blind new Promise(setTimeout) sleeps outside the polling allowlist', () => {
    // The `new Promise((r) => setTimeout(r, ms))` idiom is a hard sleep — it races
    // against whatever state the test expects next. Only files that use it as the
    // fixed interval inside a bounded status-polling loop (checking job.status each
    // iteration, not waiting on an unobservable side effect) are allowed.
    const POLL_ALLOWLIST = new Set([
      'tests/e2e/pptx-import-fidelity.spec.js',
      'tests/e2e/pptx-import-visual-fidelity.spec.js',
      'tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js',
      'tests/e2e/fixtures/test-fixtures.js',
      'tests/e2e/helpers/pptx-import-api-helper.js',
    ])

    const result = spawnSync('git', ['grep', '-lE', 'new Promise.*setTimeout', 'tests/e2e/'], {
      encoding: 'utf8',
    })
    const offenders = result.stdout
      .split('\n')
      .filter(Boolean)
      .map((file) => file.replace(/\\/g, '/'))
      .filter((file) => !POLL_ALLOWLIST.has(file))

    expect(offenders).toEqual([])
  })
})
