import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TriviaChampRenderer } from './trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot'
import { NamePickerRenderer } from './name-picker-interactive-game-renderer'
import { ScattergoriesRenderer } from './scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring'
import { FourCornersRenderer } from './four-corners-live-game-renderer-with-timer-scoring-leaderboard'
vi.mock('../../../../hooks/use-game-socket', () => ({
  useGameSocket: () => ({ isConnected: true }),
}))
const question = {
  id: 'q',
  kind: 'single-choice',
  prompt: 'Choose Earth',
  points: 10,
  timeLimit: 30,
  options: [
    { id: 'earth', text: 'Earth' },
    { id: 'mars', text: 'Mars' },
  ],
  answerKey: { optionId: 'earth' },
  feedback: { correct: '', incorrect: '', explanation: '' },
}
afterEach(() => vi.useRealTimers())
describe('interactive canonical retained readers', () => {
  it('uses authored round identities and buzz policy with repeated labels', () => {
    vi.useFakeTimers()
    render(
      <TriviaChampRenderer
        element={{
          isPresenting: true,
          questions: [question],
          buzzPoints: 0,
          rounds: [
            {
              id: 'round-final',
              name: 'Authored Final',
              mode: 'buzzer',
              questionIds: ['q'],
              timeLimit: 45,
            },
          ],
          teams: [
            { id: 'blue', name: 'Same' },
            { id: 'red', name: 'Same' },
          ],
        }}
      />
    )
    expect(screen.getByRole('button', { name: 'Authored Final' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Buzz/ }))
    fireEvent.click(screen.getByRole('button', { name: 'End' }))
    expect(screen.getByText('0 pts')).toBeTruthy()
  })
  it('uses stable canonical answer keys and prompt in jackpot display', () => {
    render(
      <TriviaChampRenderer
        element={{
          isPresenting: true,
          questions: [question],
          buzzPoints: 10,
          rounds: [{ id: 'r', name: 'Final', mode: 'team', questionIds: ['q'], timeLimit: 30 }],
          teams: [],
          jackpotRound: { enabled: true, multiplier: 5 },
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Jackpot/ }))
    expect(screen.getByText('Choose Earth')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'REVEAL' }))
    expect(screen.getByText('Earth')).toBeTruthy()
  })
  it('announces a canonical picker label without object coercion', () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(
      <NamePickerRenderer
        isPresenting={true}
        element={{
          id: 'picker',
          pickerMode: 'button',
          showConfetti: false,
          items: [{ id: 'ada', label: 'Ada', weight: 1 }],
          excludeAfterPick: false,
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'PICK!' }))
    act(() => vi.advanceTimersByTime(1100))
    expect(screen.getByText('Ada')).toBeTruthy()
    vi.restoreAllMocks()
  })
  it('shows canonical category labels in retained scattergories preview', () => {
    render(<ScattergoriesRenderer element={{ categories: [{ id: 'food', label: 'Food' }] }} />)
    expect(screen.getByText('Food')).toBeTruthy()
  })
  it('maps reordered canonical answer identity to the displayed corner rather than a random answer', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(
      <FourCornersRenderer
        element={{
          isPresenting: true,
          cornerCount: 2,
          timerDuration: 30,
          questions: [{ ...question, options: [...question.options].reverse() }],
          players: [],
          eliminateMode: 'wrong',
        }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'START ROUND' }))
    expect(screen.getByText('Choose Earth')).toBeTruthy()
    expect(screen.getByText('Earth')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'REVEAL ANSWER' }))
    expect(screen.getByText('Correct: NE')).toBeTruthy()
    vi.restoreAllMocks()
  })
})
