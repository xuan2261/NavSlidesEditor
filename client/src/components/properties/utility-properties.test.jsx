import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultGameConfig } from 'revealjs-shared'
import LuckyWheelProperties from './lucky-wheel-properties'
import CountdownProperties from './countdown-properties'
import ScoreboardProperties from './scoreboard-properties'

afterEach(cleanup)
const variables = [{ id: 'deck-score', name: 'Deck score', initialValue: 10, min: 0, max: 100 }]
function Harness({ Component, type }) {
  const [element, setElement] = useState(() => ({
    id: 'saved',
    [type]: createDefaultGameConfig(type),
  }))
  const [history, setHistory] = useState([])
  const update = (patch) => {
    setHistory((previous) => [...previous, element])
    setElement((previous) => ({ ...previous, [type]: { ...previous[type], ...patch } }))
  }
  return (
    <>
      <Component config={element[type]} variables={variables} onChange={update} />
      <button
        onClick={() => {
          setElement(JSON.parse(JSON.stringify(element)))
        }}
      >
        Reload
      </button>
      <button
        onClick={() => {
          setElement(history.at(-1))
          setHistory(history.slice(0, -1))
        }}
      >
        Undo
      </button>
      <output data-testid="saved">{JSON.stringify(element)}</output>
    </>
  )
}
const saved = () => JSON.parse(screen.getByTestId('saved').textContent)
const change = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))

describe('utility authoring nested persistence', () => {
  it('edits and reorders weighted prizes without losing IDs across reload and undo', () => {
    render(<Harness Component={LuckyWheelProperties} type="lucky-wheel" />)
    const id = saved()['lucky-wheel'].items[0].id
    change('Prize 1 label', 'Choice')
    change('Prize 1 weight', '3.5')
    click('Move prize 1 down')
    click('Reload')
    expect(saved()['lucky-wheel'].items[1]).toEqual({ id, label: 'Choice', weight: 3.5 })
    click('Undo')
    expect(saved()['lucky-wheel'].items[0].id).toBe(id)
    change('Prize 1 weight', '0')
    expect(screen.getByLabelText('Prize 1 weight').getAttribute('aria-invalid')).toBe('true')
    expect(saved()['lucky-wheel'].items[0].weight).toBe(3.5)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remove prize after picking' }))
    expect(saved()['lucky-wheel'].removeAfterPick).toBe(false)
  })
  it('authors duration, auto-start and expiry text without accepting fractional seconds', () => {
    render(<Harness Component={CountdownProperties} type="countdown" />)
    change('Duration in seconds', '8')
    change('Expiry message', 'Finished')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start automatically' }))
    click('Reload')
    expect(saved().countdown).toMatchObject({
      durationSeconds: 8,
      autoStart: true,
      expiryMessage: 'Finished',
    })
    change('Duration in seconds', '1.5')
    expect(saved().countdown.durationSeconds).toBe(8)
    expect(screen.getByLabelText('Duration in seconds').getAttribute('aria-invalid')).toBe('true')
  })
  it('keeps exactly one score authority while editing team binding, order and bounds', () => {
    render(<Harness Component={ScoreboardProperties} type="scoreboard" />)
    const id = saved().scoreboard.teams[0].id
    change('Team 1 name', 'Falcons')
    change('Team 1 color', '#abcdef')
    change('Team 1 initial score', '3')
    change('Team 1 variable', 'deck-score')
    expect(saved().scoreboard.teams[0]).toEqual({
      id,
      name: 'Falcons',
      color: '#abcdef',
      variableId: 'deck-score',
    })
    expect(screen.queryByLabelText('Team 1 initial score')).toBeNull()
    expect(screen.getByText(/Deck variable initial value: 10/)).toBeTruthy()
    click('Move team 1 down')
    click('Reload')
    expect(saved().scoreboard.teams[1].id).toBe(id)
    change('Team 2 variable', '')
    expect(saved().scoreboard.teams[1]).toEqual({
      id,
      name: 'Falcons',
      color: '#abcdef',
      initialScore: 0,
    })
    change('Score step', '0.5')
    change('Minimum score', '-2')
    change('Maximum score', '20')
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Reset only variables bound to this scoreboard' })
    )
    expect(saved().scoreboard).toMatchObject({
      step: 0.5,
      minScore: -2,
      maxScore: 20,
      resetBoundVariables: true,
    })
    expect(saved()).not.toHaveProperty('teams')
  })
})
