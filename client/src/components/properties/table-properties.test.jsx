import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TableProperties from './table-properties'

describe('table properties controls', () => {
  it('[cap:element.table tier:deep depth:behavior] writes structure, header, border, and cell style updates', () => {
    const onUpdate = vi.fn()
    render(
      <TableProperties
        element={{
          id: 'table-1',
          type: 'table',
          data: [['A', 'B']],
          headerRow: false,
          borderStyle: 'solid',
          cellStyles: {},
        }}
        onUpdate={onUpdate}
      />
    )

    fireEvent.click(screen.getByTestId('prop-table-add-row'))
    fireEvent.click(screen.getByTestId('prop-table-add-col'))
    fireEvent.click(screen.getByTestId('prop-table-header-row'))
    fireEvent.change(screen.getByTestId('prop-table-border-style'), { target: { value: 'dashed' } })
    fireEvent.focus(screen.getByTestId('prop-table-cell-0-1'))
    fireEvent.change(screen.getByTestId('prop-table-cell-bg'), { target: { value: '#22c55e' } })
    fireEvent.change(screen.getByTestId('prop-table-cell-text'), { target: { value: '#111827' } })
    fireEvent.click(screen.getByTestId('prop-table-cell-bold'))
    fireEvent.change(screen.getByTestId('prop-table-cell-align'), { target: { value: 'center' } })
    fireEvent.change(screen.getByTestId('prop-table-cell-valign'), { target: { value: 'bottom' } })

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: [['A', 'B'], ['', '']] }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: [['A', 'B', '']] }))
    expect(onUpdate).toHaveBeenCalledWith({ headerRow: true })
    expect(onUpdate).toHaveBeenCalledWith({ borderStyle: 'dashed' })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cellStyles: expect.objectContaining({ bgColors: [[null, '#22c55e']] }),
    }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cellStyles: expect.objectContaining({ textColors: [[null, '#111827']] }),
    }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cellStyles: expect.objectContaining({ isBold: [[null, true]] }),
    }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cellStyles: expect.objectContaining({ aligns: [[null, 'center']] }),
    }))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      cellStyles: expect.objectContaining({ vAligns: [[null, 'bottom']] }),
    }))
  })

  it('[cap:element.table tier:deep depth:behavior] treats merge authoring as read-only import fidelity', () => {
    render(
      <TableProperties
        element={{
          id: 'table-1',
          type: 'table',
          data: [['A', 'B'], ['C', 'D']],
          mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
        }}
        onUpdate={vi.fn()}
      />
    )

    expect(screen.queryByText(/merge/i)).toBeNull()
    expect(screen.queryByText(/unmerge/i)).toBeNull()
  })
})
