import { describe, expect, it } from 'vitest'
import {
  createLivePlayerState,
  reduceLivePlayerState,
} from '../../src/education/live-player-state.js'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 2 }
describe('learner session and receipt ordering', () => {
  it('never regresses round from a delayed join session', () => {
    let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
      ...E,
      playerId: 'p',
    })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 1,
      phase: 'active',
    })
    expect(reduceLivePlayerState(state, 'game-session', { ...E, roundId: 1 })).toBe(state)
  })
  it('cannot resurrect a retired room from a delayed session', () => {
    let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
      ...E,
      playerId: 'p',
    })
    state = reduceLivePlayerState(state, 'game-session', {
      ...E,
      roomInstanceId: 'replacement',
      generation: 0,
      roundId: 0,
    })
    expect(reduceLivePlayerState(state, 'game-session', E)).toBe(state)
  })
  it('preserves pending engagement command until its own receipt, not an unrelated aggregate', () => {
    let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
      ...E,
      playerId: 'p',
    })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 1,
      phase: 'active',
    })
    state = reduceLivePlayerState(state, 'pending', { commandId: 'vote' })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 2,
      phase: 'active',
      ownSubmission: { optionId: 'a' },
    })
    expect(state.pending.commandId).toBe('vote')
    state = reduceLivePlayerState(state, 'game-command-result', {
      ...E,
      stateVersion: 2,
      commandId: 'vote',
      accepted: true,
    })
    expect(state.pending).toBe(null)
    expect(state.receipt.accepted).toBe(true)
  })
})
