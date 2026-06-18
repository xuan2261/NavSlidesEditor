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
  poll: {
    title: 'Live Poll',
    prompt: 'Initial poll prompt',
    options: [
      { id: 'option-a', text: 'Option A' },
      { id: 'option-b', text: 'Option B' },
    ],
    showResults: true,
    allowVoteChange: true,
    timerDuration: 30,
  },
  'word-cloud': {
    title: 'Word Cloud',
    prompt: 'Initial word prompt',
    maxPhraseLength: 40,
    maxSubmissionsPerPlayer: 5,
    displayLimit: 50,
    timerDuration: 30,
  },
  matching: {
    title: 'Matching',
    prompt: 'Initial matching prompt',
    pairs: [
      { promptId: 'prompt-a', prompt: 'HTTP', targetId: 'target-a', target: 'Protocol' },
      { promptId: 'prompt-b', prompt: 'TLS', targetId: 'target-b', target: 'Security' },
    ],
    timerDuration: 60,
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

  it('[cap:element.game depth:behavior] edits poll prompt and option config under the selected subtype', () => {
    const onUpdate = vi.fn()
    render(<GameProperties element={makeElement('poll')} onUpdate={onUpdate} onDelete={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Ask a quick class poll...'), {
      target: { value: 'Which theorem should we review?' },
    })
    expect(onUpdate).toHaveBeenLastCalledWith({
      poll: expect.objectContaining({ prompt: 'Which theorem should we review?' }),
    })

    fireEvent.change(screen.getByDisplayValue('Option A'), {
      target: { value: 'Pythagorean theorem' },
    })
    expect(onUpdate).toHaveBeenLastCalledWith({
      poll: expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ id: 'option-a', text: 'Pythagorean theorem' }),
        ]),
      }),
    })
  })

  it('[cap:element.game depth:behavior] edits word cloud prompt under the selected subtype', () => {
    const onUpdate = vi.fn()
    render(<GameProperties element={makeElement('word-cloud')} onUpdate={onUpdate} onDelete={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Ask for words or short phrases...'), {
      target: { value: 'Describe today in one word' },
    })

    expect(onUpdate).toHaveBeenLastCalledWith({
      'word-cloud': expect.objectContaining({ prompt: 'Describe today in one word' }),
    })
  })

  it('[cap:element.game depth:behavior] edits matching prompt and pair config under the selected subtype', () => {
    const onUpdate = vi.fn()
    render(<GameProperties element={makeElement('matching')} onUpdate={onUpdate} onDelete={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('Ask learners to match items...'), {
      target: { value: 'Match networking terms' },
    })
    expect(onUpdate).toHaveBeenLastCalledWith({
      matching: expect.objectContaining({ prompt: 'Match networking terms' }),
    })

    fireEvent.change(screen.getByLabelText('Pair 1 target'), {
      target: { value: 'Application protocol' },
    })
    expect(onUpdate).toHaveBeenLastCalledWith({
      matching: expect.objectContaining({
        pairs: expect.arrayContaining([
          expect.objectContaining({
            promptId: 'prompt-a',
            prompt: 'HTTP',
            targetId: 'target-a',
            target: 'Application protocol',
          }),
        ]),
      }),
    })
  })

  it('[cap:element.game depth:behavior] enforces matching pair authoring bounds', () => {
    const onUpdate = vi.fn()
    const eightPairs = Array.from({ length: 8 }, (_, i) => ({
      promptId: `prompt-${i}`,
      prompt: `Term ${i}`,
      targetId: `target-${i}`,
      target: `Definition ${i}`,
    }))
    const { rerender } = render(
      <GameProperties
        element={{ ...makeElement('matching'), matching: { ...nestedDefaults.matching, pairs: eightPairs } }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )

    expect(screen.getByText('+ Add').disabled).toBe(true)

    rerender(<GameProperties element={makeElement('matching')} onUpdate={onUpdate} onDelete={() => {}} />)
    fireEvent.click(screen.getAllByText('X')[0])
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('+ Add'))
    expect(onUpdate).toHaveBeenCalledWith({
      matching: expect.objectContaining({
        pairs: expect.arrayContaining([
          expect.objectContaining({ prompt: 'Term 3', target: 'Definition 3' }),
        ]),
      }),
    })
  })
})
