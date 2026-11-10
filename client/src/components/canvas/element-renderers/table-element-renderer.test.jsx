import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TableRenderer } from './table-element-renderer'

describe('TableRenderer', () => {
  it('applies per-cell typography and row/column sizing', () => {
    const { container } = render(
      <TableRenderer
        element={{
          id: 'table-1',
          type: 'table',
          data: [['A', 'B']],
          colWidths: [80, 120],
          rowHeights: [40],
          cellStyles: {
            fontSizes: [[24, null]],
            fontFamilies: [['Arial', null]],
          },
        }}
        isEditing={false}
        onUpdateElement={vi.fn()}
      />
    )

    const col = container.querySelector('col')
    const row = container.querySelector('tr')
    const cell = container.querySelector('td')
    expect(
      parseFloat(col?.style.width) / parseFloat(container.querySelectorAll('col')[1].style.width)
    ).toBeCloseTo(2 / 3)
    expect(parseFloat(row?.style.height)).toBe(100)
    expect(cell?.style.fontSize).toBe('24px')
    expect(cell?.style.fontFamily).toBe('Arial')
  })

  it('focuses the first cell when keyboard editing starts without a mouse cell', () => {
    const { container, rerender } = render(
      <TableRenderer
        element={{ id: 'table-1', type: 'table', data: [['A', 'B']] }}
        isEditing={false}
        onUpdateElement={vi.fn()}
      />
    )

    rerender(
      <TableRenderer
        element={{ id: 'table-1', type: 'table', data: [['A', 'B']] }}
        isEditing
        onUpdateElement={vi.fn()}
      />
    )

    expect(document.activeElement).toBe(container.querySelector('textarea'))
  })

  it('keeps malformed rows editable without throwing', () => {
    const onUpdateElement = vi.fn()
    const { container } = render(
      <TableRenderer
        element={{ id: 'table-mixed', type: 'table', data: [['A'], null] }}
        isEditing
        onUpdateElement={onUpdateElement}
      />
    )

    fireEvent.change(container.querySelector('textarea'), { target: { value: 'B' } })

    expect(onUpdateElement).toHaveBeenCalledWith('table-mixed', { data: [['B'], []] })
  })

  it('[red defect:renderer.contrast] uses readable light-background defaults', () => {
    const { container } = render(
      <TableRenderer
        element={{ id: 'table-1', type: 'table', data: [['A']] }}
        isEditing={false}
        onUpdateElement={vi.fn()}
      />
    )

    const cell = container.querySelector('td')
    expect(cell?.style.color).toBe('rgb(20, 20, 19)')
    expect(cell?.style.border).toContain('rgba(20,20,19,0.22)')
  })

  it('fits the source table grid budget and preserves merged cell typography, zero inset, and unequal dimensions', () => {
    const { container } = render(<TableRenderer element={{ id: 'source-table', type: 'table', width: 410, height: 151,
      headerRow: true, borderWidth: 1, colWidths: [1, 2, 3], rowHeights: [1, 3],
      data: [['Header', '', 'Owner'], ['Body', '', 'Name']],
      mergedCells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
      cellStyles: { fontSizes: [[11, null, 11]], textColors: [['#000000', null, '#000000']],
        isBold: [[true, null, false]], vAligns: [['top', null, 'top']],
        insets: [[{ top: 3.6, right: 3.6, bottom: 3.6, left: 0 }]] },
    }} isEditing={false} />)
    const cell = container.querySelector('td')
    expect(cell.colSpan).toBe(2)
    expect(container.querySelectorAll('td')).toHaveLength(5)
    expect(cell.style.fontSize).toBe('11px')
    expect(cell.style.color).toBe('rgb(0, 0, 0)')
    expect(cell.style.fontWeight).toBe('600')
    expect(cell.style.verticalAlign).toBe('top')
    expect(cell.style.paddingTop).toBe('3.6px')
    expect(cell.style.paddingLeft).toBe('0px')
    expect(container.querySelectorAll('td')[1].style.fontWeight).toBe('400')
    expect(container.querySelector('table').style.boxSizing).toBe('border-box')
    const columns = [...container.querySelectorAll('col')].map((col) => parseFloat(col.style.width))
    const rows = [...container.querySelectorAll('tr')].map((row) => parseFloat(row.style.height))
    expect(columns.reduce((total, width) => total + width, 0)).toBeCloseTo(409)
    expect(columns[2] / columns[0]).toBeCloseTo(3)
    expect(rows).toEqual([37.5, 112.5])
  })
})
