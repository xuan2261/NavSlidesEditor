import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const sockets = vi.hoisted(() => [])
vi.mock('socket.io-client', () => ({
  io: () => {
    const handlers = new Map()
    const socket = {
      connected: true,
      on: (name, fn) => handlers.set(name, fn),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      receive: (name, payload) => handlers.get(name)?.(payload),
    }
    sockets.push(socket)
    return socket
  },
}))
import { useGameSocket } from './use-game-socket.js'
const E = { gameId: 'g', roomInstanceId: 'room', generation: 1, roundId: 0 }
describe('shared game socket hook', () => {
  beforeEach(() => {
    sockets.length = 0
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })
  it('publishes absolute observer leaderboard and never grants mutation rights', async () => {
    const { result, unmount } = renderHook(() => useGameSocket('g', 'Observer', 'observer'))
    await act(async () => {})
    const socket = sockets[0],
      received = []
    const listener = (event) => received.push(event.detail)
    window.addEventListener('navslides:game-leaderboard', listener)
    act(() => socket.receive('game-session', { ...E, playerId: 'observer', gameType: 'poll' }))
    act(() =>
      socket.receive('game-round-state', {
        ...E,
        phase: 'active',
        gameType: 'poll',
        stateVersion: 1,
        leaderboard: [{ playerId: 'p', score: 42 }],
      })
    )
    expect(result.current.leaderboard[0].score).toBe(42)
    expect(received.at(-1).scores[0].score).toBe(42)
    expect(result.current.emit('game-reset', {})).toBe(false)
    window.removeEventListener('navslides:game-leaderboard', listener)
    unmount()
  })
  it('keeps host authority session scoped and cancels join after unmount during bootstrap', async () => {
    let resolve
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((done) => {
            resolve = done
          })
      )
    )
    const options = { gameType: 'poll', options: { prompt: 'Choice', options: [] } }
    const { unmount } = renderHook(() => useGameSocket('g', 'Host', 'host', options))
    unmount()
    await act(async () => {
      resolve({ ok: true, json: async () => ({ hostCapability: 'secret' }) })
    })
    expect(sockets[0].emit).not.toHaveBeenCalledWith('game-join', expect.anything())
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1)
    expect(
      Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).some(
        (key) => localStorage.getItem(key) === 'secret'
      )
    ).toBe(false)
  })
  it('retires expired observer authority and rejoins only within its bounded retry policy', async () => {
    vi.useFakeTimers()
    const options = { retryOnRoomNotFound: true, maxRoomNotFoundRetries: 1 }
    const { result, unmount } = renderHook(() =>
      useGameSocket('g', 'Observer', 'observer', options)
    )
    try {
      await act(async () => {})
      const socket = sockets[0]
      act(() => socket.receive('game-session', { ...E, gameType: 'poll', playerId: null }))
      act(() =>
        socket.receive('game-round-state', {
          ...E,
          stateVersion: 1,
          gameType: 'poll',
          phase: 'waiting',
        })
      )
      act(() => socket.receive('game-room-expired', { gameId: 'g', roomInstanceId: 'room' }))
      expect(result.current.snapshot.roomInstanceId).toBe(null)
      expect(result.current.isConnected).toBe(false)
      await act(async () => vi.advanceTimersByTime(1000))
      expect(socket.emit.mock.calls.filter(([event]) => event === 'game-join')).toHaveLength(2)
      act(() => socket.receive('game-error', { message: 'room-not-found' }))
      await act(async () => vi.advanceTimersByTime(2000))
      expect(socket.emit.mock.calls.filter(([event]) => event === 'game-join')).toHaveLength(2)
      unmount()
      vi.advanceTimersByTime(1000)
      expect(socket.disconnect).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
