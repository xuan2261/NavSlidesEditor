import { describe, expect, it } from 'vitest'
import { computeMixedValues } from './selection-mixed-values'

const els = [
  { id: 'a', opacity: 1, x: 10, fill: '#f00' },
  { id: 'b', opacity: 0.5, x: 10, fill: '#0f0' },
  { id: 'c', opacity: 0.5, x: 99, fill: '#f00' },
]

describe('computeMixedValues', () => {
  it('flags isMixed true when selected elements differ on a key', () => {
    const r = computeMixedValues(els, ['a', 'b'], ['opacity'])
    expect(r.opacity.isMixed).toBe(true)
    expect(r.opacity.value).toBe(1) // primary (first id) value
  })

  it('flags isMixed false + returns the shared value when all agree', () => {
    const r = computeMixedValues(els, ['a', 'b'], ['x'])
    expect(r.x.isMixed).toBe(false)
    expect(r.x.value).toBe(10)
  })

  it('never flags mixed for a single selected id', () => {
    const r = computeMixedValues(els, ['b'], ['opacity', 'x', 'fill'])
    expect(r.opacity.isMixed).toBe(false)
    expect(r.opacity.value).toBe(0.5)
    expect(r.fill.isMixed).toBe(false)
  })

  it('handles multiple keys at once', () => {
    const r = computeMixedValues(els, ['a', 'b', 'c'], ['opacity', 'x', 'fill'])
    expect(r.opacity.isMixed).toBe(true) // 1, .5, .5
    expect(r.x.isMixed).toBe(true) // 10,10,99
    expect(r.fill.isMixed).toBe(true) // #f00,#0f0,#f00
  })

  it('treats identical values across all selected as not mixed', () => {
    const r = computeMixedValues(els, ['a', 'c'], ['fill'])
    expect(r.fill.isMixed).toBe(false)
    expect(r.fill.value).toBe('#f00')
  })

  it('returns isMixed false for an empty or missing selection', () => {
    expect(computeMixedValues(els, [], ['opacity']).opacity.isMixed).toBe(false)
    expect(computeMixedValues([], ['a'], ['opacity']).opacity.isMixed).toBe(false)
  })

  it('treats undefined values consistently (all-undefined → not mixed)', () => {
    const r = computeMixedValues(
      [{ id: 'a' }, { id: 'b' }],
      ['a', 'b'],
      ['rotation']
    )
    expect(r.rotation.isMixed).toBe(false)
  })
})
