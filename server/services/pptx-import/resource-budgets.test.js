import { describe, expect, it } from 'vitest'
import budgets from './resource-budgets.js'

const { assertParsedOutputBudget, createMediaBudget } = budgets

describe('PPTX import resource budgets', () => {
  it('rejects parser output whose serialized bytes exceed the budget', () => {
    expect(() => assertParsedOutputBudget({ slides: [{ text: 'x'.repeat(64) }] }, 32))
      .toThrow(/parsed output byte budget/i)
  })

  it('enforces one aggregate media budget across multiple assets', () => {
    const budget = createMediaBudget(10)
    expect(budget.tryReserve(6)).toBe(true)
    // A refusal must not consume budget, or a single oversized asset would
    // starve the smaller ones that still fit after it.
    expect(budget.tryReserve(5)).toBe(false)
    expect(budget.usedBytes).toBe(6)
    expect(budget.tryReserve(4)).toBe(true)
    expect(budget.usedBytes).toBe(10)
  })

  it('charges repeated identical content once', () => {
    const budget = createMediaBudget(10)
    // One template background repeated on every slide is one image. Charging it
    // per placement would starve the real media that follows it.
    expect(budget.tryReserve(6, 'hash-a')).toBe(true)
    expect(budget.tryReserve(6, 'hash-a')).toBe(true)
    expect(budget.tryReserve(6, 'hash-a')).toBe(true)
    expect(budget.usedBytes).toBe(6)
    expect(budget.tryReserve(6, 'hash-b')).toBe(false)
    expect(budget.tryReserve(4, 'hash-b')).toBe(true)
    expect(budget.usedBytes).toBe(10)
  })

  it('does not record a key it refused, so a later smaller deck still pays', () => {
    const budget = createMediaBudget(10)
    expect(budget.tryReserve(20, 'hash-a')).toBe(false)
    expect(budget.usedBytes).toBe(0)
    // The refusal must not have registered 'hash-a' as already paid for.
    expect(budget.tryReserve(6, 'hash-a')).toBe(true)
    expect(budget.usedBytes).toBe(6)
  })

  it('refuses a reservation whose size is not a usable byte count', () => {
    const budget = createMediaBudget(10)
    for (const bad of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(budget.tryReserve(bad)).toBe(false)
    }
    expect(budget.usedBytes).toBe(0)
  })
})
