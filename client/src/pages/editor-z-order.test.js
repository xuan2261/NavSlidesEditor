import { describe, it, expect } from 'vitest'
import { computeZOrderStep, computeMultiZOrderStep, computeMultiZOrderEdge } from '../utils/z-order-step'

const zById = (els, id) => els.find((e) => e.id === id).zIndex
const orderIds = (els) =>
  [...els].sort((a, b) => a.zIndex - b.zIndex).map((e) => e.id)

describe('z-order stepping crosses exactly one neighbor', () => {
  it('bring-forward lifts an element above the next-higher neighbor despite a gap', () => {
    // A=1, B=5: naive +1 (A->2) never crosses B. Must end with A above B.
    const els = [
      { id: 'A', zIndex: 1 },
      { id: 'B', zIndex: 5 },
    ]
    const res = computeZOrderStep(els, 'A', 'forward')
    expect(zById(res, 'A')).toBeGreaterThan(zById(res, 'B'))
  })

  it('leaves the relative order of uninvolved elements unchanged', () => {
    // C stays below both after A steps over B.
    const els = [
      { id: 'C', zIndex: 1 },
      { id: 'A', zIndex: 2 },
      { id: 'B', zIndex: 8 },
    ]
    const res = computeZOrderStep(els, 'A', 'forward')
    expect(orderIds(res)).toEqual(['C', 'B', 'A'])
  })

  it('send-backward drops an element below the next-lower neighbor', () => {
    const els = [
      { id: 'A', zIndex: 2 },
      { id: 'B', zIndex: 9 },
    ]
    const res = computeZOrderStep(els, 'B', 'backward')
    expect(zById(res, 'B')).toBeLessThan(zById(res, 'A'))
  })

  it('does not inflate zIndex without bound when already topmost', () => {
    const els = [
      { id: 'A', zIndex: 1 },
      { id: 'B', zIndex: 999 },
    ]
    const res = computeZOrderStep(els, 'B', 'forward')
    // Dense renormalization caps the top at the element count.
    expect(zById(res, 'B')).toBe(2)
    expect(orderIds(res)).toEqual(['A', 'B'])
  })

  it('floors at 1 when sending the bottommost element backward', () => {
    const els = [
      { id: 'A', zIndex: 3 },
      { id: 'B', zIndex: 7 },
    ]
    const res = computeZOrderStep(els, 'A', 'backward')
    expect(zById(res, 'A')).toBe(1)
    expect(orderIds(res)).toEqual(['A', 'B'])
  })

  it('breaks ties by current array order before stepping', () => {
    // A and B both zIndex 2; A appears first so renders below B.
    const els = [
      { id: 'A', zIndex: 2 },
      { id: 'B', zIndex: 2 },
      { id: 'C', zIndex: 5 },
    ]
    const res = computeZOrderStep(els, 'A', 'forward')
    // A crosses B; no two elements share a zIndex.
    const zs = res.map((e) => e.zIndex).sort()
    expect(new Set(zs).size).toBe(zs.length)
    expect(orderIds(res)).toEqual(['B', 'A', 'C'])
  })
})

describe('z-order stepping acts on every selected element', () => {
  it('moves all selected elements forward, preserving their relative order', () => {
    const els = [
      { id: 'A', zIndex: 1 },
      { id: 'B', zIndex: 2 },
      { id: 'C', zIndex: 3 },
      { id: 'D', zIndex: 4 },
    ]
    const res = computeMultiZOrderStep(els, ['A', 'B'], 'forward')
    // A,B each cross one neighbor; A stays below B (relative order kept).
    expect(zById(res, 'A')).toBeLessThan(zById(res, 'B'))
    expect(zById(res, 'A')).toBeGreaterThan(zById(res, 'C'))
    expect(orderIds(res)).toEqual(['C', 'A', 'B', 'D'])
  })

  it('moves all selected elements backward, preserving their relative order', () => {
    const els = [
      { id: 'A', zIndex: 1 },
      { id: 'B', zIndex: 2 },
      { id: 'C', zIndex: 3 },
      { id: 'D', zIndex: 4 },
    ]
    const res = computeMultiZOrderStep(els, ['C', 'D'], 'backward')
    expect(zById(res, 'C')).toBeLessThan(zById(res, 'D'))
    expect(orderIds(res)).toEqual(['A', 'C', 'D', 'B'])
  })
})

describe('multi-select to-front / to-back moves the whole selection as a block', () => {
  const els = [
    { id: 'A', zIndex: 1 },
    { id: 'B', zIndex: 2 },
    { id: 'C', zIndex: 3 },
    { id: 'D', zIndex: 4 },
  ]

  it('to-front lifts every selected id above all unselected, order preserved', () => {
    const res = computeMultiZOrderEdge(els, ['A', 'B'], 'front')
    // unselected C,D keep their relative order at the bottom; A,B sit on top.
    expect(orderIds(res)).toEqual(['C', 'D', 'A', 'B'])
  })

  it('to-back drops every selected id below all unselected, order preserved', () => {
    const res = computeMultiZOrderEdge(els, ['C', 'D'], 'back')
    expect(orderIds(res)).toEqual(['C', 'D', 'A', 'B'])
  })

  it('empty selection only renormalizes', () => {
    const res = computeMultiZOrderEdge(els, [], 'front')
    expect(orderIds(res)).toEqual(['A', 'B', 'C', 'D'])
  })
})
