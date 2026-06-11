import { describe, expect, it } from 'vitest'
import { resolveMergedCells } from '../src/table-merge-resolver.js'

describe('resolveMergedCells', () => {
  it('returns a span entry for a 2-col merge and marks the covered cell', () => {
    const { spans, covered } = resolveMergedCells([{ row: 0, col: 0, colSpan: 2, rowSpan: 1 }])
    expect(spans.get('0:0')).toEqual({ rowSpan: 1, colSpan: 2 })
    expect(covered.has('0:1')).toBe(true)
    expect(covered.has('0:0')).toBe(false) // the anchor is not covered
  })

  it('handles a rowSpan merge', () => {
    const { spans, covered } = resolveMergedCells([{ row: 1, col: 0, colSpan: 1, rowSpan: 2 }])
    expect(spans.get('1:0')).toEqual({ rowSpan: 2, colSpan: 1 })
    expect(covered.has('2:0')).toBe(true)
  })

  it('handles a block merge (2x2)', () => {
    const { spans, covered } = resolveMergedCells([{ row: 0, col: 0, colSpan: 2, rowSpan: 2 }])
    expect(spans.get('0:0')).toEqual({ rowSpan: 2, colSpan: 2 })
    expect([...covered].sort()).toEqual(['0:1', '1:0', '1:1'])
  })

  it('clamps spans to a minimum of 1 and defaults missing fields', () => {
    const { spans } = resolveMergedCells([{ row: 0, col: 0 }])
    expect(spans.get('0:0')).toEqual({ rowSpan: 1, colSpan: 1 })
  })

  it('returns empty structures for no merges', () => {
    const { spans, covered } = resolveMergedCells([])
    expect(spans.size).toBe(0)
    expect(covered.size).toBe(0)
  })

  it('tolerates a non-array argument', () => {
    const { spans, covered } = resolveMergedCells(undefined)
    expect(spans.size).toBe(0)
    expect(covered.size).toBe(0)
  })
})
