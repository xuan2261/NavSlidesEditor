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
    expect(col?.style.width).toBe('80px')
    expect(row?.style.height).toBe('40px')
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

  it('renders malformed persisted table data without crashing', () => {
    expect(() => render(
      <TableRenderer
        element={{
          id: 'table-invalid',
          type: 'table',
          data: [{ invalid: true }, [{ value: 'cell' }]],
          mergedCells: [null, { row: 0, col: 0, rowSpan: 'bad' }],
        }}
        isEditing={false}
        onUpdateElement={vi.fn()}
      />
    )).not.toThrow()
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
})
