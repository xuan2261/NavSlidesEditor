import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GameProperties from './game-properties.jsx'
import { createGameElement } from '../../constants/game-element-types-constants.js'

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
  it('only exposes controls backed by the selected subtype schema', () => {
    const { rerender } = render(
      <GameProperties element={makeElement('name-picker')} onUpdate={vi.fn()} onDelete={() => {}} />
    )

    expect(screen.queryByRole('button', { name: 'Scoring' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Display' })).toBeTruthy()

    rerender(
      <GameProperties element={makeElement('relay-race')} onUpdate={vi.fn()} onDelete={() => {}} />
    )
    expect(screen.queryByText(/Questions \(/)).toBeNull()

    rerender(
      <GameProperties element={makeElement('trivia-champ')} onUpdate={vi.fn()} onDelete={() => {}} />
    )
    expect(screen.queryByText(/Questions \(/)).toBeNull()

    rerender(
      <GameProperties element={makeElement('jeopardy')} onUpdate={vi.fn()} onDelete={() => {}} />
    )
    expect(screen.queryByText(/Questions \(/)).toBeNull()
    expect(screen.getByText('+ Add Team')).toBeTruthy()

    rerender(
      <GameProperties element={makeElement('hot-potato')} onUpdate={vi.fn()} onDelete={() => {}} />
    )
    expect(screen.getByText(/Questions \(/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Scoring' })).toBeNull()
  })

  it('keeps question row actions and correct-answer choices keyboard accessible', () => {
    const onUpdate = vi.fn()
    render(
      <GameProperties
        element={{
          ...makeElement('hot-potato'),
          'hot-potato': {
            ...nestedDefaults['hot-potato'],
            questions: [{
              id: 'q-1',
              question: 'Accessible question',
              options: ['Yes', 'No'],
              correctIndex: 0,
              points: 10,
            }],
          },
        }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )

    const edit = screen.getByRole('button', { name: 'Edit question 1' })
    const remove = screen.getByRole('button', { name: 'Delete question 1' })
    expect(edit.className).not.toContain('opacity-0')
    expect(remove.className).not.toContain('opacity-0')
    fireEvent.click(edit)
    expect(screen.getByRole('radio', { name: 'Mark option A as correct' })).toBeTruthy()
  })

  it('reads nested factory data and writes canonical nested fields', () => {
    const onUpdate = vi.fn()
    render(
      <GameProperties
        element={createGameElement('name-picker')}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )

    expect(screen.getByRole('textbox').value).toContain('Học sinh 1')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ada, Grace' } })

    expect(onUpdate).toHaveBeenLastCalledWith({
      'name-picker': expect.objectContaining({ items: ['Ada', 'Grace'] }),
    })
  })

  it('does not copy flat legacy fields from the previous subtype when switching', () => {
    const onUpdate = vi.fn()
    render(
      <GameProperties
        element={{
          ...createGameElement('hot-potato'),
          title: 'Legacy hot potato title',
          questions: [{ id: 'legacy-question' }],
        }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'poll' } })

    expect(onUpdate).toHaveBeenLastCalledWith({
      gameType: 'poll',
      poll: expect.objectContaining({
        title: 'Live Poll',
        options: expect.any(Array),
      }),
    })
    expect(onUpdate.mock.lastCall[0].poll).not.toHaveProperty('questions')
  })

  it('reads flat legacy display controls when nested values are absent', () => {
    const onUpdate = vi.fn()
    const { unmount } = render(
      <GameProperties
        element={{ ...makeElement('name-picker'), showConfetti: false }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    expect(screen.getByRole('checkbox', { name: 'Confetti animation' }).checked).toBe(false)
    unmount()

    render(
      <GameProperties
        element={{ ...makeElement('jeopardy'), showTimer: false }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    expect(screen.getByRole('checkbox', { name: 'Show timer' }).checked).toBe(false)
  })

  it('preserves nested confetti state in the display control', () => {
    const onUpdate = vi.fn()
    render(
      <GameProperties
        element={{
          ...makeElement('name-picker'),
          'name-picker': { ...nestedDefaults['name-picker'], showConfetti: false },
        }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    const confetti = screen.getByRole('checkbox', { name: 'Confetti animation' })
    expect(confetti.checked).toBe(false)
    fireEvent.click(confetti)
    expect(onUpdate).toHaveBeenLastCalledWith({
      'name-picker': expect.objectContaining({ showConfetti: true }),
    })
  })

  it('preserves existing subtype config when switching game types and fills missing defaults', () => {
    const onUpdate = vi.fn()
    render(
      <GameProperties
        element={{
          ...makeElement('name-picker'),
          poll: {
            prompt: 'Keep this poll prompt',
            options: [{ id: 'custom-option', text: 'Custom answer' }],
          },
        }}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'poll' } })

    expect(onUpdate).toHaveBeenLastCalledWith({
      gameType: 'poll',
      poll: expect.objectContaining({
        prompt: 'Keep this poll prompt',
        options: [{ id: 'custom-option', text: 'Custom answer' }],
        showResults: true,
      }),
    })
  })

  it('[cap:element.game depth:persistence] writes non-default persisted config for supported controls', () => {
    ['name-picker', 'jeopardy', 'four-corners', 'relay-race'].forEach((gameType) => {
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
