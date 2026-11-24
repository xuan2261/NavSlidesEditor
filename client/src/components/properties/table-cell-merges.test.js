import { describe, expect, it } from 'vitest'
import { mergeTableCellRight, unmergeTableCell } from './table-cell-merges'

const data = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
]
describe('table merge transactions', () => {
  it('extends the effective anchor of a covered cell without touching hidden data or styles', () => {
    const element = {
      data,
      cellStyles: { textColors: [['#123456', '#abcdef']] },
      mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
    }
    const merged = mergeTableCellRight(element, { row: 1, col: 1 })
    expect(merged).toEqual({ mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 3 }] })
    expect(unmergeTableCell({ ...element, ...merged }, { row: 1, col: 2 })).toEqual({
      mergedCells: [],
    })
    expect(element.data).toEqual(data)
    expect(element.cellStyles.textColors).toEqual([['#123456', '#abcdef']])
  })

  it('refuses extension that overlaps a different merge on any affected row', () => {
    const element = {
      data,
      mergedCells: [
        { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
        { row: 1, col: 2, rowSpan: 1, colSpan: 2 },
      ],
    }
    expect(mergeTableCellRight(element, { row: 0, col: 0 })).toBeNull()
    expect(element.mergedCells).toHaveLength(2)
  })

  it('refuses ragged-row and right-bound overflow, preserving unaffected merges on unmerge', () => {
    expect(mergeTableCellRight({ data }, { row: 1, col: 3 })).toBeNull()
    expect(
      mergeTableCellRight(
        { data: [['A', 'B'], ['C']], mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 1 }] },
        { row: 0, col: 0 }
      )
    ).toBeNull()
    const other = { row: 1, col: 2, rowSpan: 1, colSpan: 2 }
    expect(
      unmergeTableCell(
        { data, mergedCells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }, other] },
        { row: 0, col: 1 }
      )
    ).toEqual({ mergedCells: [other] })
  })
})
