import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ShapeProperties from './shape-properties'
import { ShapeRenderer } from '../canvas/element-renderers/shape-element-renderer'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'

const shape = {
  id: 'shape',
  type: 'shape',
  shape: 'rect',
  x: 100,
  y: 70,
  width: 220,
  height: 140,
  rotation: 25,
  fill: '#ffaa00',
  stroke: '#112233',
  strokeWidth: 2,
  text: 'Preserved label',
  textHtml: '<strong>Rich label</strong>',
  fontSize: 28,
  textColor: '#ffffff',
}

function Authoring({ initial = [shape], ids = initial.map((element) => element.id) }) {
  const [elements, setElements] = useState(initial)
  const selected = elements.find((element) => element.id === ids.at(-1))
  return (
    <>
      <ShapeProperties
        element={selected}
        elements={elements}
        selectedElementIds={ids}
        onUpdate={(update) => {
          const patches = buildSelectionUpdates(elements, ids, selected.id, update)
          setElements((previous) =>
            previous.map((element) => ({
              ...element,
              ...patches.find((patch) => patch.id === element.id),
            }))
          )
        }}
      />
      <div data-testid="rendered-shape">
        <ShapeRenderer element={elements[0]} />
      </div>
      <output data-testid="shape-state">{JSON.stringify(elements)}</output>
    </>
  )
}

describe('shape kind authoring', () => {
  it('changes geometry while preserving rich label, style and position', () => {
    render(<Authoring />)
    fireEvent.change(screen.getByLabelText('Shape kind'), { target: { value: 'hexagon' } })
    const elements = JSON.parse(screen.getByTestId('shape-state').textContent)
    expect(elements[0]).toEqual({ ...shape, shape: 'hexagon' })
    expect(screen.getByTestId('rendered-shape').querySelector('polygon')).toBeTruthy()
    expect(screen.getByTestId('rendered-shape').textContent).toContain('Rich label')
  })

  it('does not offer line conversion or alter selected connectors', () => {
    const line = {
      id: 'connector',
      type: 'line',
      x: 0,
      y: 0,
      width: 200,
      height: 5,
      connections: { start: { targetId: 'shape', anchor: 'e' } },
      arrowEnd: 'triangle',
    }
    render(<Authoring initial={[line, shape]} />)
    const control = screen.getByLabelText('Shape kind')
    expect(Array.from(control.options).map((option) => option.value)).not.toContain('line')
    fireEvent.change(control, { target: { value: 'circle' } })
    const elements = JSON.parse(screen.getByTestId('shape-state').textContent)
    expect(elements[0]).toEqual(line)
    expect(elements[1]).toEqual({ ...shape, shape: 'circle' })
  })
})
