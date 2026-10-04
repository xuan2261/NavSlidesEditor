import { describe, expect, it } from 'vitest'
import {
  createLivePlayerState,
  reduceLivePlayerState,
} from '../../src/education/live-player-state.js'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
describe('public aggregate boundary', () => {
  it.each([
    { poll: { options: 'bad' } },
    { wordCloud: { words: [{ text: 'idea', count: Infinity }] } },
    { matching: { prompts: [{ id: 'p', text: 'Prompt' }], targets: null } },
    { scatter: { letter: 'B', categories: [{ id: 'animal', label: null }] } },
    { leaderboard: [{ playerId: 'p', score: NaN }] },
  ])('rejects malformed aggregates without replacing accepted state: %j', (fields) => {
    let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
      ...E,
      playerId: 'p',
    })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 1,
      phase: 'waiting',
    })
    const next = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 2,
      phase: 'active',
      ...fields,
    })
    expect(next.stateVersion).toBe(1)
    expect(next.phase).toBe('waiting')
  })
})
