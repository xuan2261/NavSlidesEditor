import React, { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import InteractionVariableControls from './interaction-variable-controls.jsx'
const initial = { id: 'score', name: 'Points', initialValue: 2, min: 0, max: 10 }
afterEach(cleanup)
function Harness({ initialVariables = [initial] }) {
  const [variables, setVariables] = useState(initialVariables)
  return (
    <>
      <InteractionVariableControls variables={variables} onChange={setVariables} />
      <output data-testid="saved">{JSON.stringify(variables)}</output>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('saved').textContent)
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
describe('interaction variable authoring', () => {
  it('keeps invalid numeric drafts recoverable without saving invalid values', () => {
    render(<Harness />)
    change('Variable 1 initial value', '')
    expect(screen.getByLabelText('Variable 1 initial value').value).toBe('')
    expect(screen.getByRole('alert').textContent).toMatch(/finite|numeric/i)
    expect(saved()[0].initialValue).toBe(2)
    change('Variable 1 initial value', '3.5')
    expect(saved()[0].initialValue).toBe(3.5)
    expect(screen.queryByRole('alert')).toBeNull()
    change('Variable 1 minimum', '5')
    expect(saved()[0].min).toBe(0)
    expect(screen.getByRole('alert').textContent).toMatch(/min/)
    change('Variable 1 initial value', '6')
    expect(saved()[0]).toMatchObject({ min: 5, initialValue: 6 })
  })
  it('adds, edits and removes authored variables without runtime score data', () => {
    render(<Harness initialVariables={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add variable' }))
    change('Variable 1 name', 'Team points')
    change('Variable 1 maximum', '50')
    expect(saved()[0]).toMatchObject({ name: 'Team points', min: 0, max: 50, initialValue: 0 })
    expect(saved()[0]).not.toHaveProperty('value')
    fireEvent.click(screen.getByRole('button', { name: 'Remove variable 1' }))
    expect(saved()).toEqual([])
  })
  it('prevents adding a thirty-third variable', () => {
    render(
      <Harness
        initialVariables={Array.from({ length: 32 }, (_, i) => ({ ...initial, id: `v${i}` }))}
      />
    )
    expect(screen.getByRole('button', { name: 'Add variable' }).disabled).toBe(true)
  })
})
