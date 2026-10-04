import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TableProperties from './table-properties'

describe('table properties controls', () => {
  it('clamps stale selected cells after row and column deletion before style updates', () => {
    function StatefulHarness() {
      const [element, setElement] = useState({
        id: 'table-1',
        type: 'table',
        data: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        cellStyles: {},
      })
      return (
        <TableProperties
          element={element}
          onUpdate={(update) => setElement((current) => ({ ...current, ...update }))}
        />
      )
    }

    render(<StatefulHarness />)

    fireEvent.focus(screen.getByTestId('prop-table-cell-1-1'))
    fireEvent.click(screen.getByTestId('prop-table-remove-row'))
    fireEvent.click(screen.getByTestId('prop-table-remove-col'))
    fireEvent.change(screen.getByTestId('prop-table-cell-bg'), { target: { value: '#22c55e' } })

    expect(screen.getByText('Selected Cell R1C1')).toBeTruthy()
    expect(screen.getByTestId('prop-table-cell-bg').value).toBe('#22c55e')
  })
})
