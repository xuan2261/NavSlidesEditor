import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultGameConfig, validateGameConfig } from 'revealjs-shared'
import MemoryProperties from './memory-properties'
import FlashcardsProperties from './flashcards-properties'
import { ValidationErrors } from './game-authoring-fields'

afterEach(cleanup)
function Harness({ type }) {
  const [config, setConfig] = useState(() => createDefaultGameConfig(type))
  const Component = type === 'memory' ? MemoryProperties : FlashcardsProperties
  return (
    <>
      <Component
        config={config}
        onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
      />
      <ValidationErrors errors={validateGameConfig(type, config).errors} />
      <output data-testid="state">{JSON.stringify(config)}</output>
    </>
  )
}
const state = () => JSON.parse(screen.getByTestId('state').textContent)
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = (label) => fireEvent.click(screen.getByRole('button', { name: label }))

describe('memory and flashcard authoring', () => {
  it('edits both pair faces, keeps stable IDs during reorder, and supports add/delete', () => {
    render(<Harness type="memory" />)
    const firstId = state().pairs[0].id
    change('Pair 1 first text', 'Country')
    change('Pair 1 second text', 'Capital')
    click('Move pair 1 down')
    expect(state().pairs[1]).toEqual({
      id: firstId,
      first: { type: 'text', text: 'Country' },
      second: { type: 'text', text: 'Capital' },
    })
    click('Add pair')
    const addedId = state().pairs[2].id
    expect([firstId, state().pairs[0].id]).not.toContain(addedId)
    click('Delete pair 3')
    expect(state().pairs.map((pair) => pair.id)).not.toContain(addedId)
  })

  it('validates settings recoverably and authors safe image source/alt on either pair face', () => {
    render(<Harness type="memory" />)
    change('Mismatch delay in milliseconds', '5001')
    expect(state().mismatchDelayMs).toBe(1000)
    expect(screen.getByRole('alert').textContent).toMatch(/0 to 5000/)
    change('Mismatch delay in milliseconds', '0')
    change('Match points', '25')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Shuffle on start' }))
    expect(state()).toMatchObject({ mismatchDelayMs: 0, matchPoints: 25, shuffleOnStart: false })
    change('Pair 1 first content type', 'image')
    change('Pair 1 first image URL', '/uploads/france.png')
    change('Pair 1 first image alt text', 'Map of France')
    expect(state().pairs[0].first).toEqual({
      type: 'image',
      src: '/uploads/france.png',
      alt: 'Map of France',
    })
    change('Pair 1 first image URL', 'javascript:alert(1)')
    expect(state().pairs[0].first.src).toBe('/uploads/france.png')
    expect(screen.getByRole('alert').textContent).toMatch(/unsafe|URL|image/i)
    change('Pair 1 first image URL', '/uploads/paris.png')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('edits front/back content, navigation order and shuffle policy without persisting study progress', () => {
    render(<Harness type="flashcards" />)
    const firstId = state().cards[0].id
    change('Card 1 front text', 'Question')
    change('Card 1 back content type', 'image')
    change('Card 1 back image URL', '/uploads/answer.png')
    change('Card 1 back image alt text', 'Diagram answer')
    click('Move card 1 down')
    expect(state().cards[1]).toEqual({
      id: firstId,
      front: { type: 'text', text: 'Question' },
      back: { type: 'image', src: '/uploads/answer.png', alt: 'Diagram answer' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Shuffle on start' }))
    expect(state().shuffleOnStart).toBe(true)
    click('Add card')
    const addedId = state().cards[2].id
    click('Delete card 3')
    expect(state().cards.map((card) => card.id)).not.toContain(addedId)
    expect(state()).not.toHaveProperty('studiedIds')
  })
})
