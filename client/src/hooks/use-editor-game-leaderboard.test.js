import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useGameSocket: vi.fn() }))
vi.mock('./use-game-socket.js', () => mocks)

import { useEditorGameLeaderboard } from './use-editor-game-leaderboard.js'

describe('useEditorGameLeaderboard', () => {
  beforeEach(() => mocks.useGameSocket.mockClear())

  it('observes the active game and accepts its leaderboard events', () => {
    const gameElement = { id: 'game-1', gameType: 'hot-potato', questions: [] }
    const { result } = renderHook(() => useEditorGameLeaderboard(gameElement))

    expect(mocks.useGameSocket).toHaveBeenCalledWith(
      'game-1',
      'editor-observer',
      'observer',
      { retryOnRoomNotFound: true, maxRoomNotFoundRetries: 5 },
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('navslides:game-leaderboard', {
        detail: {
          gameId: 'game-1',
          scores: [{ playerId: 'p1', name: 'Ada', score: 42 }],
        },
      }))
    })

    expect(result.current).toEqual([{ playerId: 'p1', name: 'Ada', score: 42 }])
  })

  it('resets when the active game changes and ignores other game events', () => {
    const { result, rerender } = renderHook(
      ({ gameId }) => useEditorGameLeaderboard(gameId),
      { initialProps: { gameId: 'game-1' } },
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('navslides:game-leaderboard', {
        detail: { gameId: 'game-1', scores: { Blue: 10 } },
      }))
    })
    expect(result.current).toEqual([{ team: 'Blue', score: 10 }])

    rerender({ gameId: 'game-2' })
    expect(result.current).toEqual([])

    act(() => {
      window.dispatchEvent(new CustomEvent('navslides:game-leaderboard', {
        detail: { gameId: 'game-1', scores: [{ name: 'Stale', score: 99 }] },
      }))
    })
    expect(result.current).toEqual([])
  })
})
