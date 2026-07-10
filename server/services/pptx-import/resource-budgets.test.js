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
    budget.reserve(6)
    expect(() => budget.reserve(5)).toThrow(/aggregate media budget/i)
    expect(budget.usedBytes).toBe(6)
  })
})
