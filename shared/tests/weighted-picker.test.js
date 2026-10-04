import { describe, it, expect } from 'vitest'
import { pickWeightedItem } from '../src/education/weighted-picker.js'

const items = [
  { id: 'a', label: 'A', weight: 1 },
  { id: 'b', label: 'B', weight: 3 },
]
describe('weighted picker consumer outcomes', () => {
  it('uses half-open cumulative intervals at zero, a threshold and near one', () => {
    expect(pickWeightedItem(items, { weighted: true, random: () => 0 })).toBe(items[0])
    expect(pickWeightedItem(items, { weighted: true, random: () => 0.249999 })).toBe(items[0])
    expect(pickWeightedItem(items, { weighted: true, random: () => 0.25 })).toBe(items[1])
    expect(pickWeightedItem(items, { weighted: true, random: () => 1 - Number.EPSILON })).toBe(
      items[1]
    )
  })
  it('ignores unequal weights in uniform mode, but honors them when enabled', () => {
    expect(pickWeightedItem(items, { random: () => 0.3 })).toBe(items[0])
    expect(pickWeightedItem(items, { weighted: true, random: () => 0.3 })).toBe(items[1])
  })
  it('excludes stable IDs without modifying the pool and returns null for exhausted pools', () => {
    const before = structuredClone(items)
    expect(pickWeightedItem(items, { excludedIds: ['a'], random: () => 0 })).toBe(items[1])
    expect(pickWeightedItem(items, { excludedIds: ['a', 'b'] })).toBeNull()
    expect(pickWeightedItem([])).toBeNull()
    expect(items).toEqual(before)
  })
  it('supports missing legacy weights as one and avoids overflow for huge finite weights', () => {
    const huge = [
      { id: 'a', weight: Number.MAX_VALUE },
      { id: 'b', weight: Number.MAX_VALUE },
    ]
    expect(pickWeightedItem(huge, { weighted: true, random: () => 0.5 })).toBe(huge[1])
    expect(pickWeightedItem(huge, { weighted: true, random: () => 1 - Number.EPSILON })).toBe(
      huge[1]
    )
    const missing = [{ id: 'a' }, { id: 'b' }]
    expect(pickWeightedItem(missing, { weighted: true, random: () => 0.5 })).toBe(missing[1])
  })
  it.each([0, -1, NaN, Infinity, '2', null])(
    'rejects invalid weight %s even in uniform/excluded mode',
    (weight) => {
      expect(() => pickWeightedItem([{ id: 'bad', weight }], { excludedIds: ['bad'] })).toThrow(
        /weight/
      )
    }
  )
  it.each([-0.1, 1, Infinity, NaN, '0.5'])('rejects invalid random result %s', (result) => {
    expect(() => pickWeightedItem(items, { random: () => result })).toThrow(/random.*\[0,\s*1\)/i)
  })
  it('rejects malformed sampler inputs instead of returning a fabricated result', () => {
    expect(() => pickWeightedItem(null)).toThrow(/items/)
    expect(() => pickWeightedItem([null])).toThrow(/items/)
    expect(() => pickWeightedItem(items, { random: 4 })).toThrow(/random/)
    expect(() => pickWeightedItem(items, { excludedIds: 'a' })).toThrow(/excludedIds/)
    expect(() => pickWeightedItem(items, { weighted: 'yes' })).toThrow(/weighted/)
  })
})
