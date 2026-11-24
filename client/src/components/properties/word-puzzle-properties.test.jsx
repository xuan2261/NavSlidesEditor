import React, { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createDefaultGameConfig } from 'revealjs-shared'
import WordPuzzleProperties from './word-puzzle-properties'

afterEach(cleanup)
function Harness({ gameType, initial, onSave }) {
  const [config, setConfig] = useState(initial || createDefaultGameConfig(gameType))
  return (
    <>
      <WordPuzzleProperties
        gameType={gameType}
        config={config}
        onChange={(patch) => setConfig((current) => ({ ...current, ...patch }))}
      />
      <button onClick={() => onSave(config)}>Capture config</button>
    </>
  )
}

describe('word puzzle canonical authoring', () => {
  it('generates and persists a full crossword layout while preserving authored identity', () => {
    let saved
    const initial = createDefaultGameConfig('crossword')
    render(
      <Harness
        gameType="crossword"
        initial={initial}
        onSave={(value) => {
          saved = value
        }}
      />
    )
    fireEvent.change(screen.getByLabelText('Puzzle seed'), { target: { value: '42' } })
    fireEvent.click(screen.getByLabelText('Generate crossword layout'))
    fireEvent.click(screen.getByText('Capture config'))
    expect(saved.seed).toBe(42)
    expect(saved.entries.map(({ id, answer, clue }) => ({ id, answer, clue }))).toEqual(
      initial.entries.map(({ id, answer, clue }) => ({ id, answer, clue }))
    )
    expect(
      saved.entries.every(
        (entry) =>
          Number.isInteger(entry.row) &&
          Number.isInteger(entry.column) &&
          ['across', 'down'].includes(entry.direction)
      )
    ).toBe(true)
    expect(saved).not.toHaveProperty('layoutMode')
  })
  it('edits coordinates, reports conflicting letters and reorders stable entry IDs', () => {
    let saved
    const initial = createDefaultGameConfig('crossword')
    render(
      <Harness
        gameType="crossword"
        initial={initial}
        onSave={(value) => {
          saved = value
        }}
      />
    )
    fireEvent.change(screen.getByLabelText('Entry 2 answer'), { target: { value: 'DOG' } })
    expect(
      screen
        .getAllByRole('alert')
        .some((node) => node.textContent.includes('Crossing letters conflict'))
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Entry 2 row (zero-based)'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Entry 2 column (zero-based)'), {
      target: { value: '3' },
    })
    fireEvent.click(screen.getByLabelText('Move entry 2 up'))
    fireEvent.click(screen.getByText('Capture config'))
    expect(saved.entries[0]).toMatchObject({
      id: initial.entries[1].id,
      answer: 'DOG',
      row: 2,
      column: 3,
    })
  })
  it('preserves words while editing all directions/alphabet/seed and reports empty directions', () => {
    let saved
    render(
      <Harness
        gameType="word-search"
        onSave={(value) => {
          saved = value
        }}
      />
    )
    for (const direction of ['E', 'S', 'SE'])
      fireEvent.click(screen.getByLabelText(`Direction ${direction}`))
    expect(
      screen.getAllByRole('alert').some((node) => node.textContent.includes('directions'))
    ).toBe(true)
    fireEvent.click(screen.getByLabelText('Direction NW'))
    fireEvent.change(screen.getByLabelText('Fill alphabet'), { target: { value: 'AĂÂĐỌ' } })
    fireEvent.change(screen.getByLabelText('Word 1 text'), { target: { value: 'học' } })
    fireEvent.change(screen.getByLabelText('Puzzle seed'), { target: { value: '19' } })
    fireEvent.click(screen.getByLabelText('Move word 1 down'))
    fireEvent.click(screen.getByText('Capture config'))
    expect(saved).toMatchObject({ seed: 19, alphabet: 'AĂÂĐỌ', directions: ['NW'] })
    expect(saved.words[1]).toEqual({ id: 'word-1', text: 'học' })
  })
})
