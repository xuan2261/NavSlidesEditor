import { describe, expect, it } from 'vitest'
import { computeMultiZOrderEdge, computeMultiZOrderStep } from './z-order-step'

const idsByZ = (elements) =>
  [...elements].sort((a, b) => a.zIndex - b.zIndex).map((element) => element.id)

describe('z-order-step utilities', () => {
  it('moves a multi-selection forward as a stable block without member leapfrog', () => {
    const elements = [
      { id: 'bottom', zIndex: 1 },
      { id: 'selected-a', zIndex: 2 },
      { id: 'selected-b', zIndex: 3 },
      { id: 'top', zIndex: 4 },
    ]

    const result = computeMultiZOrderStep(elements, ['selected-a', 'selected-b'], 'forward')

    expect(idsByZ(result)).toEqual(['bottom', 'top', 'selected-a', 'selected-b'])
  })

  it('moves a multi-selection to front/back as a contiguous block', () => {
    const elements = [
      { id: 'a', zIndex: 10 },
      { id: 'b', zIndex: 20 },
      { id: 'c', zIndex: 30 },
      { id: 'd', zIndex: 40 },
    ]

    expect(idsByZ(computeMultiZOrderEdge(elements, ['a', 'c'], 'front'))).toEqual([
      'b',
      'd',
      'a',
      'c',
    ])
    expect(idsByZ(computeMultiZOrderEdge(elements, ['b', 'd'], 'back'))).toEqual([
      'b',
      'd',
      'a',
      'c',
    ])
  })

  it('renormalizes duplicate and gapped z-index values after a multi-step', () => {
    const result = computeMultiZOrderStep(
      [
        { id: 'a', zIndex: 10 },
        { id: 'b', zIndex: 10 },
        { id: 'c', zIndex: 100 },
      ],
      ['a'],
      'forward'
    )

    expect(result.map((element) => element.zIndex).sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect(new Set(result.map((element) => element.zIndex)).size).toBe(3)
  })
})
