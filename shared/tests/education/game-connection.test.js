import { describe, expect, it, vi } from 'vitest'
import { createGameConnection } from '../../src/education/browser/game-connection.js'
function socket() {
  const handlers = new Map()
  return {
    connected: true,
    on: (event, fn) => handlers.set(event, [...(handlers.get(event) || []), fn]),
    off: (event, fn) =>
      handlers.set(
        event,
        (handlers.get(event) || []).filter((listener) => listener !== fn)
      ),
    emit: vi.fn(),
    disconnect: vi.fn(),
    receive: (event, data) => (handlers.get(event) || []).forEach((fn) => fn(data)),
  }
}
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
function hydrate(sock, connection, extra = {}) {
  sock.receive('game-session', { ...E, playerId: connection.playerId, sessionToken: 'token' })
  sock.receive('game-round-state', {
    ...E,
    stateVersion: 1,
    phase: 'active',
    gameType: 'quiz',
    question: { id: 'q', kind: 'fill-blank', prompt: 'Planet', points: 10, timeLimit: null },
    ...extra,
  })
}
describe('game connection ownership and hydration', () => {
  it('cannot mutate before hydration and keeps its pending answer across disconnect', () => {
    const sock = socket(),
      connection = createGameConnection({
        socket: sock,
        owned: true,
        gameId: 'g',
        playerName: 'Ada',
      })
    expect(connection.emit('game-answer', { answer: { text: 'Earth' } })).toBe(false)
    hydrate(sock, connection)
    connection.emit('game-answer', { questionId: 'q', answer: { text: 'Earth' } })
    const first = sock.emit.mock.calls.find(([name]) => name === 'game-answer')[1]
    sock.receive('disconnect')
    expect(connection.getSnapshot().pending.commandId).toBe(first.commandId)
    expect(connection.getSnapshot().leaderboard).toEqual([])
    connection.release()
    connection.release()
    expect(sock.disconnect).toHaveBeenCalledTimes(1)
  })
  it('borrowed release removes only its listeners and keeps the existing owner operational', () => {
    const sock = socket()
    let ownerVersion = 0
    sock.on('game-round-state', (state) => {
      ownerVersion = state.stateVersion
    })
    const connection = createGameConnection({
      socket: sock,
      owned: false,
      gameId: 'g',
      role: 'observer',
    })
    hydrate(sock, connection)
    const borrowedVersion = connection.getSnapshot().stateVersion
    connection.release()
    sock.receive('game-round-state', { ...E, stateVersion: 8 })
    expect(ownerVersion).toBe(8)
    expect(connection.getSnapshot().stateVersion).toBe(borrowedVersion)
    expect(sock.disconnect).not.toHaveBeenCalled()
    expect(sock.emit).not.toHaveBeenCalled()
  })
  it('binds new commands to current hydration, generates unique attempts, and does not reuse supplied identity', () => {
    const sock = socket(),
      connection = createGameConnection({ socket: sock, gameId: 'g', playerName: 'Ada' })
    hydrate(sock, connection)
    connection.emit('game-answer', {
      questionId: 'old',
      attemptId: 'forged',
      commandId: 'forged',
      playerId: 'other',
      answer: { text: 'Earth' },
    })
    const first = sock.emit.mock.calls.find(([name]) => name === 'game-answer')[1]
    expect(first).toMatchObject({ ...E, questionId: 'q', answer: { text: 'Earth' } })
    expect(first.playerId).toBeUndefined()
    expect(first.commandId).not.toBe('forged')
    expect(first.attemptId).not.toBe('forged')
    sock.receive('game-command-result', {
      ...E,
      stateVersion: 1,
      commandId: first.commandId,
      accepted: false,
      error: 'invalid-answer',
    })
    connection.emit('game-answer', { answer: { text: 'Mars' } })
    const second = sock.emit.mock.calls.filter(([name]) => name === 'game-answer')[1][1]
    expect(second.attemptId).not.toBe(first.attemptId)
    expect(second.commandId).not.toBe(first.commandId)
    connection.release()
  })
  it('normalizes HotPotato stable option ID once to the required index boundary', () => {
    const sock = socket(),
      connection = createGameConnection({ socket: sock, gameId: 'g', playerName: 'Ada' })
    hydrate(sock, connection, {
      gameType: 'hot-potato',
      question: {
        id: 'q',
        kind: 'single-choice',
        prompt: 'Planet',
        points: 10,
        timeLimit: 30,
        options: [
          { id: 'mars', text: 'Mars' },
          { id: 'earth', text: 'Earth' },
        ],
      },
    })
    connection.emit('game-answer', { answer: { optionId: 'earth' } })
    const answer = sock.emit.mock.calls.find(([name]) => name === 'game-answer')[1]
    expect(answer.answerIndex).toBe(1)
    expect(answer.answer).toBeUndefined()
    expect(answer.questionId).toBe('q')
    connection.release()
  })
})
