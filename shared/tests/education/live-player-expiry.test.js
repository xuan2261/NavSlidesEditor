import { describe, expect, it } from 'vitest'
import {
  createLivePlayerState,
  reduceLivePlayerState,
} from '../../src/education/live-player-state.js'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
describe('room expiry authorization boundary', () => {
  it('retires only its active room, preserves draft read-only and refuses delayed old hydration', () => {
    let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
      ...E,
      playerId: 'p',
    })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 1,
      phase: 'active',
    })
    state = reduceLivePlayerState(state, 'draft', { text: 'Earth' })
    expect(
      reduceLivePlayerState(state, 'game-room-expired', { gameId: 'other', roomInstanceId: 'r' })
    ).toBe(state)
    state = reduceLivePlayerState(state, 'game-room-expired', E)
    expect(state.roomInstanceId).toBe(null)
    expect(state.hydrated).toBe(false)
    expect(state.draft.text).toBe('Earth')
    expect(reduceLivePlayerState(state, 'game-session', E)).toBe(state)
    expect(
      reduceLivePlayerState(state, 'game-round-state', { ...E, stateVersion: 9, phase: 'active' })
    ).toBe(state)
    state = reduceLivePlayerState(state, 'game-session', {
      ...E,
      roomInstanceId: 'new',
      generation: 0,
      roundId: 0,
    })
    expect(state.draft).toBe(null)
    expect(state.roomInstanceId).toBe('new')
  })
})
