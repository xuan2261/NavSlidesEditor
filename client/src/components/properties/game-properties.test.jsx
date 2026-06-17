import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GameProperties from './game-properties.jsx'
import { createGameElement, GAME_TYPES } from '../../constants/game-element-types-constants.js'

const nestedDefaults = {
  'name-picker': {
    pickerMode: 'wheel',
    items: ['Alice', 'Bob'],
    timerDuration: 30,
  },
  'hot-potato': {
    title: 'Hot Potato Quiz',
    questions: [],
    timerDuration: 30,
  },
  jeopardy: {
    title: 'Jeopardy',
    teams: [{ id: 'team-1', name: 'Red', color: '#ff0000', score: 0 }],
    categories: [],
    questions: {},
    dailyDouble: [],
    timerDuration: 30,
  },
  'four-corners': {
    cornerCount: 4,
    eliminateMode: 'wrong',
    showTimer: true,
    timerDuration: 30,
  },
  'relay-race': {
    questionsPerRound: 4,
    shuffleTeams: true,
    passOnWrong: true,
    timerDuration: 30,
  },
  'trivia-champ': {
    rounds: [],
    lightningRound: { enabled: false, timePerQ: 10 },
    jackpotRound: { enabled: false, multiplier: 2 },
    timerDuration: 30,
  },
  scattergories: {
    timePerRound: 60,
    letterMode: 'random',
    categories: [],
    scoring: 'unique',
    timerDuration: 30,
  },
}

function makeElement(gameType) {
  return {
    ...createGameElement(gameType),
    [gameType]: nestedDefaults[gameType],
  }
}

describe('GameProperties game subtype persistence', () => {
  it('[cap:element.game depth:persistence] writes a non-default persisted config path for every subtype', () => {
    GAME_TYPES.all.forEach((gameType) => {
      const onUpdate = vi.fn()
      const { container, unmount } = render(
        <GameProperties element={makeElement(gameType)} onUpdate={onUpdate} onDelete={() => {}} />
      )

      if (gameType === 'name-picker') {
        fireEvent.change(screen.getByRole('textbox'), {
          target: { value: 'Ada, Grace, Linus' },
        })
        expect(onUpdate).toHaveBeenLastCalledWith({
          [gameType]: expect.objectContaining({ items: ['Ada', 'Grace', 'Linus'] }),
        })
      } else {
        const timer = container.querySelector('input[type="range"]')
        fireEvent.change(timer, { target: { value: '45' } })
        expect(onUpdate).toHaveBeenLastCalledWith({
          [gameType]: expect.objectContaining({ timerDuration: 45 }),
        })
      }

      unmount()
    })
  })

  it('[cap:element.game depth:persistence] persists Jeopardy team edits under the selected subtype config', () => {
    const onUpdate = vi.fn()
    render(<GameProperties element={makeElement('jeopardy')} onUpdate={onUpdate} onDelete={() => {}} />)

    fireEvent.click(screen.getByText('+ Add Team'))

    expect(onUpdate).toHaveBeenCalledWith({
      jeopardy: expect.objectContaining({
        teams: expect.arrayContaining([
          expect.objectContaining({ name: 'Red' }),
          expect.objectContaining({ name: 'Team 2', color: '#888888', score: 0 }),
        ]),
      }),
    })
  })
})
