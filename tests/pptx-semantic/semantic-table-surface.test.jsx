// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TableRenderer } from '../../client/src/components/canvas/element-renderers/table-element-renderer'
import TableProperties from '../../client/src/components/properties/table-properties'
import { applyTableOperation } from '../../shared/src/pptx-table-operations'
import { options, table } from './semantic-table-renderer-fixtures'

afterEach(cleanup)
const element = () => ({
  id: 'occurrence',
  pptxInstanceId: 'occurrence',
  type: 'table',
  tableDocument: table(),
  data: [['WRONG compatibility text']],
})

describe('production canonical table surface', () => {
  it('renders measured rich cells at native size instead of the compatibility snapshot', () => {
    const input = element()
    input.tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs.push({
      componentId: 'second', kind: 'text', text: 'LARGE', properties: { fontSizePt: 24 },
    })
    const before = JSON.stringify(input)
    const { container } = render(<TableRenderer element={input} tableRuntime={options()} />)
    expect(container.querySelector('svg[data-pptx-table="table"]')?.getAttribute('width')).toBe('300')
    expect(container.querySelector('[data-pptx-text-run="second"]')?.textContent).toBe('LARGE')
    expect(container.textContent).not.toContain('WRONG')
    expect(JSON.stringify(input)).toBe(before)
  })

  it('discloses missing measurement context without displaying compatibility text', () => {
    const { container } = render(<TableRenderer element={element()} />)
    expect(screen.getByRole('alert').textContent).toMatch(/font|measurement/i)
    expect(container.textContent).not.toContain('WRONG')
  })

  it('dispatches rich run edits through the typed occurrence command and retains style/identities', () => {
    const onUpdate = vi.fn(), onSemanticOperation = vi.fn(), input = element()
    const run = input.tableDocument.rows[0].cells[0].textDocument.paragraphs[0].runs[0]
    run.properties = { fontSizePt: 19, bold: true }
    render(<TableProperties element={input} onUpdate={onUpdate} onSemanticOperation={onSemanticOperation} />)
    fireEvent.change(screen.getByLabelText('Cell 1,1 paragraph 1 run 1'), { target: { value: '  edited  ' } })
    expect(onSemanticOperation).toHaveBeenCalledTimes(1)
    const wrapper = onSemanticOperation.mock.calls[0][0]
    expect(wrapper).toMatchObject({
      type: 'table.edit', instanceId: 'occurrence', componentId: 'table',
      command: { type: 'replaceCellText', cellId: 'a' },
    })
    expect(wrapper.command.textDocument.paragraphs[0].runs[0]).toEqual({ ...run, text: '  edited  ' })
    expect(onUpdate).not.toHaveBeenCalled()
    expect(run.text).toBe(' A<& ')
  })

  it('replays sizing, merge/unmerge and rich edits without deleting covered cells', () => {
    const operations = []
    function Harness() {
      const [input, setInput] = useState(element)
      return <TableProperties element={input} onSemanticOperation={(operation) => {
        operations.push(operation)
        setInput({ ...input, tableDocument: applyTableOperation(input.tableDocument, operation.command) })
      }} />
    }
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Row 1 height (EMU)'), { target: { value: '190500' } })
    fireEvent.change(screen.getByLabelText('Column 2 width (EMU)'), { target: { value: '381000' } })
    fireEvent.change(screen.getByLabelText('Merge column span'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Merge selected rectangle' }))
    expect(screen.queryByLabelText('Cell 1,2 paragraph 1 run 1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Unmerge selected cell' }))
    expect(screen.getByLabelText('Cell 1,2 paragraph 1 run 1').value).toBe('covered')
    expect(operations.map(({ command }) => command.type)).toEqual([
      'setRowHeight', 'setColumnWidth', 'mergeCells', 'unmergeCell',
    ])
  })

  it('never enables compatibility writers for a locked canonical table', () => {
    render(<TableProperties element={{ ...element(), locked: true }} onSemanticOperation={vi.fn()} />)
    expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').disabled).toBe(true)
    expect(screen.queryByTestId('prop-table-add-row')).toBeNull()
  })

  it('disables native writers when the containing slide is locked', () => {
    render(<TableProperties element={element()} slideLocked onSemanticOperation={vi.fn()} />)
    expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').disabled).toBe(true)
  })
})
