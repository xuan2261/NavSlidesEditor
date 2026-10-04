import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChartProperties from './chart-properties'

function Editor({ initial, component: Component }) {
  const [element, setElement] = useState(initial)
  return (
    <>
      <Component
        element={element}
        onUpdate={(patch) => setElement((current) => ({ ...current, ...patch }))}
      />
      <output data-testid="saved-list">{JSON.stringify(element)}</output>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('saved-list').textContent)

describe('focused list authoring', () => {
  it('retains chart label spaces and empty final labels without changing series data', async () => {
    const user = userEvent.setup()
    const datasets = [{ id: 'series', label: 'Values', data: [0, -2, 3.5], color: '#16a34a' }]
    render(
      <Editor
        component={ChartProperties}
        initial={{ id: 'chart', type: 'chart', chartData: { labels: [], datasets } }}
      />
    )
    const field = screen.getByLabelText('Chart category labels')
    await user.type(field, 'New ')
    expect(field.value).toBe('New ')
    await user.type(field, 'York, Hà Nội,')
    expect(saved().chartData.labels).toEqual(['New York', 'Hà Nội', ''])
    expect(saved().chartData.datasets).toEqual(datasets)
    await user.tab()
    expect(field.value).toBe('New York, Hà Nội, ')
  })

  it('does not carry a focused draft into another selected chart', () => {
    const onUpdate = () => {}
    const view = render(
      <ChartProperties
        element={{ id: 'first', chartData: { labels: ['Old'] } }}
        onUpdate={onUpdate}
      />
    )
    const field = screen.getByLabelText('Chart category labels')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Uncommitted display' } })
    view.rerender(
      <ChartProperties
        element={{ id: 'second', chartData: { labels: ['Other'] } }}
        onUpdate={onUpdate}
      />
    )
    expect(screen.getByLabelText('Chart category labels').value).toBe('Other')
  })
})
