import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ChartProperties from './chart-properties'
import CodeProperties from './code-properties'
import MediaProperties from './media-properties'
import TableProperties from './table-properties'
import TimelineProperties from './timeline-properties'
import { GamePropertiesQuestionEditor } from './game-properties-question-editor'
import { TableRenderer } from '../canvas/element-renderers/table-element-renderer'

function PropertyHarness({ Component, initial, renderElement }) {
  const [element, setElement] = useState(initial)
  return <>
    <Component element={element} onUpdate={(patch) => setElement((current) => ({ ...current, ...patch }))} />
    <output data-testid="saved-element">{JSON.stringify(element)}</output>
    {renderElement?.(element, setElement)}
  </>
}
const saved = () => JSON.parse(screen.getByTestId('saved-element').textContent)

describe('July property finding regressions', () => {
  it('keeps overflowing chart values finite through persisted JSON', () => {
    render(<PropertyHarness Component={ChartProperties} initial={{
      type: 'chart', chartData: { datasets: [{ data: [1], label: 'Data' }] },
    }} />)
    fireEvent.change(screen.getByLabelText('Chart series 1 values'), {
      target: { value: '1e309,-1e309,NaN,0,-2,3.5' },
    })
    expect(saved().chartData.datasets[0].data).toEqual([0, 0, 0, 0, -2, 3.5])
  })

  it('preserves partial numeric text while typing negative, decimal and exponent values', () => {
    render(<PropertyHarness Component={ChartProperties} initial={{
      type: 'chart', chartData: { datasets: [{ data: [1], label: 'Data' }] },
    }} />)
    const input = screen.getByLabelText('Chart series 1 values')
    fireEvent.focus(input)
    for (const value of ['-', '-2', '-2, 3.', '-2, 3.5', '-2, 3.5, 1e', '-2, 3.5, 1e309']) {
      fireEvent.change(input, { target: { value } })
      expect(input.value).toBe(value)
    }
    expect(saved().chartData.datasets[0].data).toEqual([-2, 3.5, 0])
    fireEvent.blur(input)
    expect(input.value).toBe('-2, 3.5, 0')
  })

  it.each([
    [0, 1, 'B'], [1, 1, 'C'], [2, 1, 'B'], [2, 2, 'B'], [0, 0, 'B'],
  ])('removing walkthrough step %i with default %i chooses %s', (index, defaultStepIndex, expected) => {
    render(<PropertyHarness Component={CodeProperties} initial={{
      type: 'code', defaultStepIndex,
      walkthroughSteps: ['A', 'B', 'C'].map((label) => ({ label, startLine: 1 })),
    }} />)
    fireEvent.click(screen.getByLabelText(`Remove walkthrough step ${index + 1}`))
    const element = saved()
    expect(element.walkthroughSteps[element.defaultStepIndex].label).toBe(expected)
    expect(screen.getByLabelText('Default walkthrough step').selectedOptions[0].textContent).toBe(expected)
  })

  it('rejects a blank selected correct answer and saves after text is supplied', () => {
    const onSave = vi.fn()
    render(<GamePropertiesQuestionEditor isOpen question={{
      id: 'q1', question: 'Which?', options: ['A', 'B', '', 'D'], correctIndex: 3,
    }} onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Question option D'), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('The correct answer must have option text')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Question option D'), { target: { value: 'Answer D' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      correctIndex: 3, options: ['A', 'B', '', 'Answer D'],
    }))
  })

  it.each(['start', 'end'])('rejects clearing the timeline %s endpoint without persisting an invalid date', (endpoint) => {
    render(<PropertyHarness Component={TimelineProperties} initial={{
      type: 'timeline', tickSpacing: 'day', timelineStart: '2026-01-01', timelineEnd: '2026-01-31',
    }} />)
    const input = screen.getByLabelText(`Timeline ${endpoint} date`)
    fireEvent.change(input, { target: { value: '' } })
    expect(saved().timelineStart).toBe('2026-01-01')
    expect(saved().timelineEnd).toBe('2026-01-31')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(input, { target: { value: '2026-01-15' } })
    const key = endpoint === 'start' ? 'timelineStart' : 'timelineEnd'
    expect(saved()[key]).toBe('2026-01-15')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('rejects reversed and equal trim endpoints while allowing the open-ended sentinel', () => {
    render(<PropertyHarness Component={MediaProperties} initial={{
      type: 'video', startTime: 0, endTime: 5,
    }} />)
    fireEvent.change(screen.getByLabelText('Video start time'), { target: { value: '10' } })
    expect(saved().startTime).toBe(0)
    expect(screen.getByRole('alert').textContent).toContain('greater than')
    fireEvent.change(screen.getByLabelText('Video start time'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Video end time'), { target: { value: '3' } })
    expect(saved().endTime).toBe(5)
    fireEvent.change(screen.getByLabelText('Video end time'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('Video start time'), { target: { value: '10' } })
    expect(saved().startTime).toBe(10)
    expect(saved().endTime).toBe(0)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('prevents covered merged-cell edits while keeping zero and anchor edits visible', () => {
    const { container } = render(<PropertyHarness Component={TableProperties} initial={{
      id: 'table', type: 'table', data: [[0, 'hidden'], ['A', 'B']],
      mergedCells: [{ row: 0, col: 0, colSpan: 2, rowSpan: 1 }],
    }} renderElement={(element) => <TableRenderer element={element} isEditing={false} />} />)
    expect(screen.getByLabelText('Table cell row 1 column 1').value).toBe('0')
    expect(container.querySelector('td').textContent).toBe('0')
    const covered = screen.getByLabelText('Table cell row 1 column 2')
    expect(covered.disabled).toBe(true)
    fireEvent.change(covered, { target: { value: 'invisible edit' } })
    expect(saved().data[0][1]).toBe('hidden')
    fireEvent.change(screen.getByLabelText('Table cell row 1 column 1'), { target: { value: 'Visible' } })
    expect(container.querySelector('td').textContent).toBe('Visible')
  })

  it('redirects cell styling to the merge anchor when the selected cell becomes covered', () => {
    const { container } = render(<PropertyHarness Component={TableProperties} initial={{
      id: 'table', type: 'table', data: [['Anchor', 'Covered']],
    }} renderElement={(element, setElement) => <>
      <button onClick={() => setElement((current) => ({
        ...current, mergedCells: [{ row: 0, col: 0, colSpan: 2, rowSpan: 1 }],
      }))}>Merge first row</button>
      <TableRenderer element={element} isEditing={false} />
    </>} />)
    fireEvent.focus(screen.getByLabelText('Table cell row 1 column 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Merge first row' }))
    fireEvent.change(screen.getByLabelText('Selected cell row 1 column 1 background color'), {
      target: { value: '#ff0000' },
    })
    expect(saved().cellStyles.bgColors[0]).toEqual(['#ff0000', null])
    expect(container.querySelector('td').style.background).toBe('rgb(255, 0, 0)')
  })
})
