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
})
