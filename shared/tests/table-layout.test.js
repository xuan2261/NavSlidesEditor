import { describe, expect, it } from 'vitest'
import { resolveTableDimensions } from '../src/table-layout.js'

describe('table proportional dimensions', () => {
  it('scales complete positive weights into the authored extent without mutating source', () => {
    const weights = [50, 150]
    expect(resolveTableDimensions(weights, 8)).toEqual([2, 6])
    expect(resolveTableDimensions(weights, 100)).toEqual([25, 75])
    expect(weights).toEqual([50, 150])
  })

  it.each(
    [[], [0, 100], [-1, 100], [null, 100], [Infinity, 100], ['bad', 100]].map((weights) => [
      weights,
    ])
  )('leaves unusable dimension lists to native table layout: %j', (weights) => {
    expect(resolveTableDimensions(weights, 8)).toBeUndefined()
  })

  it('retains positive numeric-string import weights and rejects invalid bounds', () => {
    expect(resolveTableDimensions(['20', 60], 100)).toEqual([25, 75])
    expect(resolveTableDimensions([1, 2], 0)).toBeUndefined()
    expect(resolveTableDimensions([1, 2], Infinity)).toBeUndefined()
  })
})
