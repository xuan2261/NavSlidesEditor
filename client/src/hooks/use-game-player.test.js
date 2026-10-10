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
import { useGamePlayer } from './use-game-player.js'
const E = { gameId: 'g', roomInstanceId: 'room', generation: 1, roundId: 1 }
function hydrate(socket, extra = {}) {
  const playerId = socket.emit.mock.calls.find(([event]) => event === 'game-join')[1].playerId
  socket.receive('game-session', { ...E, playerId, sessionToken: 'token', gameType: 'quiz' })
  socket.receive('game-round-state', {
    ...E,
    stateVersion: 1,
    gameType: 'quiz',
    phase: 'active',
    question: { id: 'q', kind: 'fill-blank', prompt: 'Planet', points: 10, timeLimit: null },
    ...extra,
  })
}
describe('player hook authoritative lifecycle', () => {
  beforeEach(() => {
    sockets.length = 0
    localStorage.clear()
    sessionStorage.clear()
  })
  it('supports typed questions and retains pending state through disconnect, then authoritative retry', async () => {
    const { result, unmount } = renderHook(() => useGamePlayer({ gameId: 'g', playerName: 'Ada' }))
    await act(async () => {})
    const socket = sockets[0]
    act(() => hydrate(socket))
    act(() => result.current.submitAnswer({ text: 'Mars' }))
    expect(result.current.snapshot.pending).not.toBe(null)
    expect(result.current.myScore).toBe(0)
    act(() => socket.receive('disconnect'))
    expect(result.current.isConnected).toBe(false)
    expect(result.current.snapshot.pending).not.toBe(null)
    const command = socket.emit.mock.calls.find(([event]) => event === 'game-answer')[1]
    act(() =>
      socket.receive('game-command-result', {
        ...E,
        stateVersion: 1,
        commandId: command.commandId,
        accepted: false,
        error: 'invalid-answer',
      })
    )
    expect(result.current.snapshot.pending).toBe(null)
    unmount()
    expect(socket.disconnect).toHaveBeenCalledTimes(1)
  })
  it('accepts reconnect submission and absolute score but refuses old generation results', async () => {
    const { result, unmount } = renderHook(() => useGamePlayer({ gameId: 'g', playerName: 'Ada' }))
    await act(async () => {})
    act(() =>
      hydrate(sockets[0], {
        ownSubmission: { answer: { text: 'Earth' }, result: { correct: true, terminal: true } },
        leaderboard: [],
      })
    )
    expect(result.current.answerResult.correct).toBe(true)
    act(() =>
      sockets[0].receive('game-round-state', {
        ...E,
        generation: 2,
        roundId: 0,
        stateVersion: 0,
        phase: 'waiting',
        gameType: 'quiz',
        ownSubmission: null,
      })
    )
    act(() =>
      sockets[0].receive('game-answer-result', {
        ...E,
        stateVersion: 3,
        commandId: 'old',
        accepted: true,
        result: { points: 999 },
      })
    )
    expect(result.current.answerResult).toBe(null)
    expect(result.current.myScore).toBe(0)
    unmount()
  })
})
