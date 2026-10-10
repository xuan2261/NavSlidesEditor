import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ActionControls from './action-controls'

const variables = [{ id: 'score', name: 'Blue score', initialValue: 0, min: 0, max: 100 }]
const slide = {
  id: 's',
  elements: [
    { id: 'trigger', type: 'shape' },
    { id: 'target', type: 'text', content: 'Answer' },
  ],
}
function Harness({ initial = { id: 'trigger', type: 'shape' } }) {
  const [element, setElement] = useState(initial)
  return (
    <>
      <ActionControls
        element={element}
        slide={slide}
        presentation={{ slides: [slide], interactionVariables: variables }}
        onUpdate={(patch) => setElement((old) => ({ ...old, ...patch }))}
      />
      <output aria-label="Authored action">{JSON.stringify(element)}</output>
    </>
  )
}
const authored = () => JSON.parse(screen.getByLabelText('Authored action').textContent)

describe('authored interaction actions', () => {
  it('authors a bounded score operation and an explicitly scoped target without stale fields', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Element action'), { target: { value: 'score-add' } })
    fireEvent.change(screen.getByLabelText('Score variable'), { target: { value: 'score' } })
    fireEvent.change(screen.getByLabelText('Score amount'), { target: { value: '7' } })
    expect(authored().action).toEqual({ kind: 'score-add', variableId: 'score', amount: 7 })
    fireEvent.change(screen.getByLabelText('Element action'), { target: { value: 'show' } })
    fireEvent.change(screen.getByLabelText('Target element'), { target: { value: 'target' } })
    expect(authored().action).toEqual({ kind: 'show', targetElementId: 'target' })
  })

  it('retains an unresolved target until an explicit repair and authors variable-reset opt in', () => {
    render(
      <Harness
        initial={{
          id: 'trigger',
          type: 'shape',
          action: {
            kind: 'show',
            targetElementId: 'missing',
            referenceError: 'Copied target is unavailable.',
          },
        }}
      />
    )
    expect(authored().action.targetElementId).toBe('missing')
    expect(screen.getByRole('alert').textContent).toContain('unavailable')
    fireEvent.change(screen.getByLabelText('Target element'), { target: { value: 'target' } })
    expect(authored().action).toEqual({ kind: 'show', targetElementId: 'target' })
    fireEvent.change(screen.getByLabelText('Element action'), { target: { value: 'reset-slide' } })
    expect(authored().action.resetVariables).toBe(false)
    fireEvent.click(screen.getByLabelText('Reset deck variables'))
    expect(authored().action).toEqual({ kind: 'reset-slide', resetVariables: true })
    fireEvent.change(screen.getByLabelText('Initial runtime visibility'), {
      target: { value: 'hidden' },
    })
    expect(authored().initialVisibility).toBe('hidden')
  })
})
