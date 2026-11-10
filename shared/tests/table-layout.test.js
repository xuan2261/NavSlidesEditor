import { describe, expect, it } from 'vitest'
import { resolveTableDimensions, resolveTableInsets, resolveTableBorderInsets, resolveTableContentExtent } from '../src/table-layout.js'

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

  it('reserves collapsed perimeter halves without changing the authored box or asymmetric weights', () => {
    const table = { width: 410, height: 151, data: [['A', 'B', 'C'], ['D', 'E', 'F']], borderWidth: 1,
      colWidths: [1, 2, 3], rowHeights: [1, 3] }
    const extent = resolveTableContentExtent(table)
    expect(extent).toEqual({ width: 409, height: 150 })
    const columns = resolveTableDimensions(table.colWidths, extent.width)
    const rows = resolveTableDimensions(table.rowHeights, extent.height)
    expect(columns.reduce((sum, width) => sum + width, 0)).toBeCloseTo(409)
    expect(columns[2] / columns[0]).toBeCloseTo(3)
    expect(rows).toEqual([37.5, 112.5])
    expect(table.width).toBe(410)
    expect(table.height).toBe(151)
  })

  it('uses merged anchor perimeter borders, ignoring covered cell borders and invisible strokes', () => {
    const table = { width: 100, height: 80, borderWidth: 0, data: [['A', ''], ['', '']],
      mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }], cellStyles: { borders: [[
        { top: { width: 2 }, right: { width: 4 }, bottom: { width: 6 }, left: { width: 10, style: 'none' } },
        { right: { width: 100 } },
      ], [{ bottom: { width: 100 } }]] } }
    expect(resolveTableBorderInsets(table)).toEqual({ top: 1, right: 2, bottom: 3, left: 0 })
    expect(resolveTableContentExtent(table)).toEqual({ width: 98, height: 76 })
  })

  it('inherits only absent or invalid inset sides and retains explicit zero', () => {
    expect(resolveTableInsets({ top: 0, right: 3.6, bottom: -1, left: Infinity }, 8)).toEqual({ top: 0, right: 3.6, bottom: 8, left: 8 })
    expect(resolveTableInsets(null, 0)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})
