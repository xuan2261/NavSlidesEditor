import { describe, expect, it } from 'vitest'
import {
  createLivePlayerState,
  reduceLivePlayerState,
} from '../../src/education/live-player-state.js'
import { createGameConnection } from '../../src/education/browser/game-connection.js'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
const question = {
  id: 'q',
  kind: 'single-choice',
  prompt: 'Choose',
  options: [{ id: 'a', text: 'Alpha' }],
  points: 10,
  timeLimit: null,
}
describe('learner public boundary validation', () => {
  it('cannot expose malformed or private question config or mutate an absolute score from it', () => {
    let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
      ...E,
      playerId: 'p',
    })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 1,
      phase: 'active',
      gameType: 'quiz',
      question,
    })
    for (const invalid of [
      { ...question, answerKey: { optionId: 'a' } },
      { ...question, options: ['Alpha'] },
      { ...question, kind: 'unknown' },
    ]) {
      const next = reduceLivePlayerState(state, 'game-round-state', {
        ...E,
        stateVersion: 2,
        phase: 'active',
        question: invalid,
        leaderboard: [{ playerId: 'p', score: 999 }],
      })
      expect(next.question).toBe(question)
      expect(next.leaderboard).toEqual([])
      expect(next.error).toBeTruthy()
    }
  })
  it('ignores a different player session without persisting its credential or joining as that actor', () => {
    const handlers = new Map(),
      storage = new Map()
    const persistence = {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    }
    const connection = createGameConnection({
      socket: {
        connected: false,
        on: (event, fn) => handlers.set(event, fn),
        off: () => {},
        emit: () => {},
        disconnect: () => {},
      },
      gameId: 'g',
      role: 'player',
      storage: persistence,
      id: () => 'own-player',
    })
    handlers.get('game-session')({ ...E, playerId: 'other', sessionToken: 'other-secret' })
    expect(connection.getSnapshot().roomInstanceId).toBe(null)
    expect(connection.getSnapshot().playerId).toBe('own-player')
    expect(Array.from(storage.values())).not.toContain('other-secret')
    connection.release()
  })
})
