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

  it('transports retained warning data without collector closures and keeps omission accounting', () => {
    const warnings = createBoundedWarnings({ maxCount: 1, maxBytes: 1024 })
    const retained = { type: 'unsupported-source', sourceLocation: { partUri: 'ppt/slides/slide1.xml' } }
    warnings.push(retained, { type: 'omitted-source' })
    const transported = structuredClone(warnings)
    expect(transported).toEqual([retained])
    expect(warnings.omittedCount).toBe(1)
    expect(pushImportWarning(warnings, { type: 'another-omitted-source' })).toBe(false)
    expect(warnings.omittedCount).toBe(2)
    expect(transported).toEqual([retained])
  })

  it('allows zero-warning usage', () => {
    const warnings = createBoundedWarnings()
    expect(warnings).toHaveLength(0)
    expect(warnings.omittedCount).toBe(0)
  })
})
