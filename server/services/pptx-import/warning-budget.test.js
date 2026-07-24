import { describe, expect, it } from 'vitest'
import { createBoundedWarnings, pushImportWarning } from './warning-budget.js'

describe('warning budget', () => {
  it('caps peak length under 10k synthetic pushes and tracks omittedCount', () => {
    const warnings = createBoundedWarnings({ maxCount: 50, maxBytes: 1024 * 1024 })
    for (let i = 0; i < 10_000; i += 1) {
      pushImportWarning(warnings, { type: 'synthetic', message: `w-${i}` })
    }
    expect(warnings.length).toBe(50)
    expect(warnings.length).toBeLessThanOrEqual(50)
    expect(warnings.omittedCount).toBe(10_000 - 50)
  })

  it('enforces byte budget even when count room remains', () => {
    const warnings = createBoundedWarnings({ maxCount: 100, maxBytes: 80 })
    for (let i = 0; i < 20; i += 1) {
      pushImportWarning(warnings, { type: 'big', message: 'x'.repeat(40) })
    }
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings.length).toBeLessThan(20)
    expect(warnings.omittedCount).toBeGreaterThan(0)
  })

  it('allows zero-warning usage', () => {
    const warnings = createBoundedWarnings()
    expect(warnings).toHaveLength(0)
    expect(warnings.omittedCount).toBe(0)
  })
})
