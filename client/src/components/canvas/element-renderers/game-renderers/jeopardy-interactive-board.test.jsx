import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { InteractiveJeopardyBoard } from './jeopardy-interactive-board.jsx'
import { JEOPARDY_STANDARD_ELEMENT } from '../../../../../../tests/e2e/education/fixtures/game-configs.js'
import { normalizeGameConfig } from 'revealjs-shared'

let currentSocketEvent = null
const mockUseGameSocket = vi.fn((_id, _name, _role) => ({
  lastEvent: currentSocketEvent,
}))

vi.mock('../../../../hooks/use-game-socket.js', () => ({
  useGameSocket: (...args) => mockUseGameSocket(...args),
}))

describe('InteractiveJeopardyBoard — Production Consumer Scoring & Sequence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSocketEvent = null
  })

  function createJeopardyElement(overrides = {}) {
    return {
      ...normalizeGameConfig(JEOPARDY_STANDARD_ELEMENT, 'jeopardy'),
      showTimer: false,
      timerDuration: 0,
      teams: [{ id: 'team-a', name: 'Team Alpha', color: '#3b82f6' }],
      ...overrides,
    }
  }

  it('floors an incorrect answer at zero then awards a correct answer with negativePoints enabled', async () => {
    const elementWithNeg = createJeopardyElement({ negativePoints: true })
    render(<InteractiveJeopardyBoard element={elementWithNeg} />)

    // Select Team Alpha via team score button
    const teamABtn = screen.getAllByRole('button', { name: /Select Team Alpha/i })[0]
    fireEvent.click(teamABtn)

    // Click World History 100 pt cell
    const cell100 = screen.getByRole('button', { name: /World History, 100 points/i })
    fireEvent.click(cell100)

    // Reveal answer and click ✗ Wrong
    fireEvent.click(screen.getByRole('button', { name: /Reveal Answer/i }))
    const wrongBtn = await screen.findByRole('button', { name: /Wrong/i })
    fireEvent.click(wrongBtn)

    // Modal auto-closes after 800ms, returning to main board
    await waitFor(
      () => {
        expect(screen.queryByTestId('game-score')).not.toBeNull()
      },
      { timeout: 3000 }
    )

    // At 0 points, incorrect answer clamps at 0 (zero-floor)
    expect(screen.getAllByTestId('game-score')[0].textContent).toBe('0')

    // Next question: Click 200 pt cell
    const cell200 = screen.getByRole('button', { name: /World History, 200 points/i })
    fireEvent.click(cell200)

    fireEvent.click(screen.getByRole('button', { name: /Reveal Answer/i }))
    const correctBtn = await screen.findByRole('button', { name: /Correct/i })
    fireEvent.click(correctBtn)

    await waitFor(
      () => {
        expect(screen.queryByTestId('game-score')).not.toBeNull()
      },
      { timeout: 3000 }
    )

    expect(screen.getAllByTestId('game-score')[0].textContent).toBe('200')
  })
})
