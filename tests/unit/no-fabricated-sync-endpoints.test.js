import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

describe('sync endpoint references', () => {
  it('does not use fabricated /api/sync/* paths in e2e tests', () => {
    const result = spawnSync('git', ['grep', '-l', 'api/sync/', 'tests/e2e/'], {
      encoding: 'utf8',
    })
    expect(result.status === 0 ? result.stdout.trim() : '').toBe('')
  })
})
