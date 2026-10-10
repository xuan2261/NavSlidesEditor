import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TableProperties from './table-properties'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'

function Selection() {
  const [elements, setElements] = useState([
    {
      id: 'a',
      type: 'table',
      data: [['A', 'B']],
      width: 400,
      height: 200,
      cellPadding: 0,
      headerIsBold: false,
      colWidths: [100, 300],
    },
    {
      id: 'b',
      type: 'table',
      data: [['C', 'D']],
      width: 400,
      height: 200,
      cellPadding: 8,
      headerIsBold: true,
      colWidths: [200, 200],
    },
    { id: 'text', type: 'text', content: 'Unchanged' },
    { id: 'locked', type: 'table', locked: true, data: [['Locked']] },
  ])
  const ids = elements.map((el) => el.id)
  return (
    <>
      <TableProperties
        element={elements[0]}
        elements={elements}
        selectedElementIds={ids}
        onUpdate={(changes) => {
          const patches = buildSelectionUpdates(elements, ids, 'a', changes)
          setElements((current) =>
            current.map((el) => ({ ...el, ...patches.find((patch) => patch.id === el.id) }))
          )
        }}
      />
      <output data-testid="saved-selection">{JSON.stringify(elements)}</output>
    </>
  )
}

describe('table mixed selection authoring', () => {
  it('shows mixed owned fields, applies explicit intent, and preserves locked/non-table elements', () => {
    render(<Selection />)
    const padding = screen.getByLabelText('Table cell padding')
    const bold = screen.getByLabelText('Table header bold')
    expect(padding.value).toBe('')
    expect(padding.getAttribute('data-mixed')).toBe('true')
    expect(bold.indeterminate).toBe(true)
    expect(screen.getByLabelText('Table column 1 width').value).toBe('')
    expect(screen.getByRole('button', { name: 'Merge selected cell right' }).disabled).toBe(true)
    fireEvent.change(padding, { target: { value: '12' } })
    fireEvent.click(bold)
    const saved = JSON.parse(screen.getByTestId('saved-selection').textContent)
    expect(saved.slice(0, 2).map((el) => [el.cellPadding, el.headerIsBold])).toEqual([
      [12, true],
      [12, true],
    ])
    expect(saved[2]).toEqual({ id: 'text', type: 'text', content: 'Unchanged' })
    expect(saved[3]).toEqual({ id: 'locked', type: 'table', locked: true, data: [['Locked']] })
  })
})
