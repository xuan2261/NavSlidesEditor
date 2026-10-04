import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderElement } from '../../../../shared/src/element-renderers.js'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'
import TableProperties from './table-properties'
import { TableRenderer } from '../canvas/element-renderers/table-element-renderer'

const table = {
  id: 'table',
  type: 'table',
  width: 400,
  height: 200,
  headerRow: true,
  data: [
    ['A', 'B', 'C'],
    ['D', 'E', 'F'],
  ],
  colWidths: [100, 100, 200],
  rowHeights: [50, 150],
  cellStyles: { isBold: [[null, true]], bgColors: [[null, '#224466']] },
}
function Authoring({ initial = table }) {
  const [elements, setElements] = useState([initial])
  const element = elements[0]
  const onUpdate = (changes) =>
    setElements((current) => {
      const patches = buildSelectionUpdates(current, ['table'], 'table', changes)
      return current.map((el) => ({ ...el, ...patches.find((patch) => patch.id === el.id) }))
    })
  return (
    <>
      <TableProperties element={element} onUpdate={onUpdate} />
      <button onClick={() => setElements(JSON.parse(JSON.stringify(elements)))}>
        Reopen table
      </button>
      <button
        onClick={() => onUpdate({ mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }] })}
      >
        Import merged table
      </button>
      <output data-testid="saved-table">{JSON.stringify(element)}</output>
      <div data-testid="canvas-table">
        <TableRenderer element={element} isEditing={false} />
      </div>
      <div
        data-testid="export-table"
        dangerouslySetInnerHTML={{ __html: renderElement(element, {}) }}
      />
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('saved-table').textContent)
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('table authored consumer outcomes', () => {
  it('merges the selected anchor, edits its style, and restores covered data when unmerged', () => {
    render(<Authoring />)
    fireEvent.focus(screen.getByLabelText('Table cell row 1 column 1'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected cell right' }))
    expect(saved().mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }])
    expect(screen.getByLabelText('Table cell row 1 column 2').disabled).toBe(true)
    expect(screen.getByTestId('canvas-table').querySelector('td').colSpan).toBe(2)
    expect(screen.getByTestId('export-table').querySelector('td').colSpan).toBe(2)
    change('Selected cell row 1 column 1 background color', '#abcdef')
    fireEvent.click(screen.getByRole('button', { name: 'Reopen table' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    expect(saved().mergedCells).toEqual([])
    expect(saved().data).toEqual(table.data)
    expect(saved().cellStyles.bgColors[0]).toEqual(['#abcdef', '#224466', null])
    expect(screen.getByLabelText('Table cell row 1 column 2').value).toBe('B')
    expect(
      [...screen.getByTestId('export-table').querySelectorAll('td')].map((td) => td.textContent)
    ).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('rejects merging into another span or past the table edge', () => {
    render(
      <Authoring
        initial={{ ...table, mergedCells: [{ row: 0, col: 1, rowSpan: 2, colSpan: 1 }] }}
      />
    )
    expect(screen.getByRole('button', { name: 'Merge selected cell right' }).disabled).toBe(true)
    fireEvent.focus(screen.getByLabelText('Table cell row 2 column 3'))
    expect(screen.getByRole('button', { name: 'Merge selected cell right' }).disabled).toBe(true)
    expect(saved().mergedCells).toEqual([{ row: 0, col: 1, rowSpan: 2, colSpan: 1 }])
  })

  it('keeps effective merged-anchor selection after merging over a previously focused cell', () => {
    render(<Authoring />)
    fireEvent.focus(screen.getByLabelText('Table cell row 2 column 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Import merged table' }))
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected cell right' }))
    expect(saved().mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 3 }])
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    expect(saved().data).toEqual(table.data)
    expect(saved().mergedCells).toEqual([])
  })

  it('renders zero padding/border and header weight inheritance while retaining explicit cell bold', () => {
    render(<Authoring />)
    change('Table cell padding', '0')
    change('Table border width', '0')
    change('Table cell background color', '#123456')
    fireEvent.click(screen.getByLabelText('Table header bold'))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen table' }))
    for (const target of ['canvas-table', 'export-table']) {
      const cells = screen.getByTestId(target).querySelectorAll('td')
      expect(cells[0].style.fontWeight).toBe('400')
      expect(cells[1].style.fontWeight).toBe('600')
      expect(cells[0].style.padding).toBe('0px')
      expect(cells[0].style.borderWidth).toBe('0px')
      expect(cells[3].style.background).toBe('rgb(18, 52, 86)')
    }
  })

  it('accepts positive fractional weights and does not overwrite them with zero or blank edits', () => {
    render(<Authoring />)
    change('Table column 1 width', '0.5')
    change('Table column 1 width', '0')
    change('Table column 1 width', '')
    expect(saved().colWidths).toEqual([0.5, 100, 200])
    fireEvent.click(screen.getByRole('button', { name: 'Reopen table' }))
    for (const target of ['canvas-table', 'export-table']) {
      const columns = screen.getByTestId(target).querySelectorAll('col')
      expect(parseFloat(columns[0].style.width) / parseFloat(columns[1].style.width)).toBeCloseTo(
        0.005
      )
    }
  })

  it('keeps row and column proportions through reopen and shape expansion', () => {
    render(<Authoring />)
    change('Table column 1 width', '200')
    change('Table row 1 height', '150')
    fireEvent.click(screen.getByRole('button', { name: 'Add table column' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add table row' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reopen table' }))
    expect(saved().colWidths).toEqual([200, 100, 200, 167])
    expect(saved().rowHeights).toEqual([150, 150, 150])
    for (const target of ['canvas-table', 'export-table']) {
      const node = screen.getByTestId(target)
      const columns = node.querySelectorAll('col')
      expect(parseFloat(columns[0].style.width) / parseFloat(columns[1].style.width)).toBeCloseTo(2)
      const extent = target === 'canvas-table' ? 100 : saved().height
      const heights = [...node.querySelectorAll('tr')].map((row) => {
        expect(row.style.height.endsWith(target === 'canvas-table' ? '%' : 'px')).toBe(true)
        return parseFloat(row.style.height)
      })
      for (const height of heights) expect(height / extent).toBeCloseTo(1 / 3)
      expect(heights.reduce((total, height) => total + height, 0)).toBeCloseTo(extent)
    }
  })
})
