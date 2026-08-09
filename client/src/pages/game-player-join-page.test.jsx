import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GamePlayerPage from './game-player-join-page.jsx'

const navigate = vi.fn()
const gamePlayerState = {
  status: 'joining',
  playerCount: 0,
  currentQuestion: null,
  pollState: null,
  wordCloudState: null,
  matchingState: null,
  timeLeft: null,
  selectedAnswer: null,
  selectedPollOption: null,
  wordCloudSubmissionCount: 0,
  matchingResult: null,
  answerResult: null,
  submitAnswer: vi.fn(),
  submitPollVote: vi.fn(),
  submitWordCloudText: vi.fn(),
  submitMatchingPairs: vi.fn(),
  myScore: 0,
  myRank: null,
  leaderboard: [],
  playerId: 'player-1',
  _isConnected: false,
  error: 'Game room expired. Please ask the host to start a new game.',
}

vi.mock('react-router-dom', () => ({
  useParams: () => ({ slideId: 'slide-1', elementId: 'game-1' }),
  useSearchParams: () => [new URLSearchParams('name=Alice')],
  useNavigate: () => navigate,
}))

vi.mock('../hooks/use-game-player', () => ({
  useGamePlayer: () => gamePlayerState,
}))

describe('GamePlayerPage direct-link lifecycle', () => {
  beforeEach(() => {
    navigate.mockClear()
  })

  it('shows joining errors from a named direct link instead of a blank wait state', () => {
    render(<GamePlayerPage />)

    expect(screen.getByText(/Game room expired\. Please ask the host to start a new game\./))
      .toBeTruthy()
  })
})
