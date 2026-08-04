import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameLeaderboardOverlay } from './game-leaderboard-overlay.jsx'

describe('GameLeaderboardOverlay', () => {
  it('renders player names from live leaderboard payloads', () => {
    render(
      <GameLeaderboardOverlay
        visible
        scores={[{ playerId: 'p1', name: 'Ada', score: 42 }]}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByRole('listitem').textContent).toBe('Ada: 42')
  })

  it('keeps duplicate player names as distinct leaderboard rows', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <GameLeaderboardOverlay
        visible
        scores={[
          { playerId: 'p1', name: 'Alex', score: 10 },
          { playerId: 'p2', name: 'Alex', score: 5 },
        ]}
        onClose={vi.fn()}
      />
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('same key'))
    errorSpy.mockRestore()
  })
})
