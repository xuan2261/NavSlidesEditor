import { describe, expect, it } from 'vitest'
import {
  createLivePlayerState,
  reduceLivePlayerState,
} from '../../src/education/live-player-state.js'
const identity = { gameId: 'g', roomInstanceId: 'room', generation: 1, roundId: 2 }
const snapshot = (extra = {}) => ({
  ...identity,
  stateVersion: 4,
  phase: 'active',
  gameType: 'quiz',
  ...extra,
})
function hydrated() {
  let state = createLivePlayerState('g')
  state = reduceLivePlayerState(state, 'game-session', { ...identity, playerId: 'p' })
  return reduceLivePlayerState(state, 'game-round-state', snapshot())
}
describe('authoritative learner transitions', () => {
  it('rejects stale room, generation, round and version without losing a draft', () => {
    let state = reduceLivePlayerState(hydrated(), 'draft', { text: 'Earth' })
    for (const change of [
      { roomInstanceId: 'other' },
      { generation: 0 },
      { roundId: 1 },
      { stateVersion: 3 },
    ]) {
      expect(reduceLivePlayerState(state, 'game-round-state', snapshot(change))).toBe(state)
    }
    state = reduceLivePlayerState(
      state,
      'game-round-state',
      snapshot({ stateVersion: 5, leaderboard: [{ playerId: 'p', score: 10 }] })
    )
    expect(state.draft).toEqual({ text: 'Earth' })
    expect(state.leaderboard[0].score).toBe(10)
  })
  it('preserves pending draft on disconnect and ignores unrelated receipts', () => {
    let state = reduceLivePlayerState(hydrated(), 'draft', { text: 'Mars' })
    state = reduceLivePlayerState(state, 'pending', { commandId: 'cmd', attemptId: 'a' })
    state = reduceLivePlayerState(state, 'disconnect', {})
    expect(state.pending.commandId).toBe('cmd')
    expect(state.draft.text).toBe('Mars')
    expect(
      reduceLivePlayerState(
        state,
        'game-command-result',
        snapshot({ commandId: 'other', accepted: true })
      )
    ).toBe(state)
  })
  it('clears generation transients atomically and cannot revive an old receipt', () => {
    let state = reduceLivePlayerState(hydrated(), 'draft', { text: 'old' })
    state = reduceLivePlayerState(state, 'pending', { commandId: 'cmd' })
    state = reduceLivePlayerState(
      state,
      'game-round-state',
      snapshot({ generation: 2, roundId: 0, stateVersion: 0 })
    )
    expect(state.draft).toBe(null)
    expect(state.pending).toBe(null)
    expect(
      reduceLivePlayerState(
        state,
        'game-command-result',
        snapshot({ commandId: 'cmd', accepted: true })
      )
    ).toBe(state)
  })
  it('makes invalid attempts editable without awarding score locally', () => {
    let state = reduceLivePlayerState(hydrated(), 'pending', { commandId: 'cmd' })
    state = reduceLivePlayerState(
      state,
      'game-command-result',
      snapshot({ commandId: 'cmd', accepted: false, error: 'invalid-answer' })
    )
    expect(state.pending).toBe(null)
    expect(state.receipt.error).toBe('invalid-answer')
    expect(state.leaderboard).toEqual([])
  })
  it.each([true, false])(
    'settles an exact pending receipt behind a peer version without rewinding state (accepted: %s)',
    (accepted) => {
      let state = reduceLivePlayerState(hydrated(), 'draft', { text: 'Mars' })
      state = reduceLivePlayerState(state, 'pending', { commandId: 'cmd', attemptId: 'a' })
      state = reduceLivePlayerState(
        state,
        'game-round-state',
        snapshot({ stateVersion: 9, leaderboard: [{ playerId: 'peer', score: 10 }] })
      )
      const receipt = snapshot({
        stateVersion: 4,
        commandId: 'cmd',
        accepted,
        ...(accepted ? {} : { error: 'invalid-answer' }),
      })
      for (const change of [
        { gameId: 'other' },
        { roomInstanceId: 'other' },
        { generation: 2 },
        { roundId: 3 },
        { commandId: 'other' },
        { stateVersion: -1 },
      ]) {
        expect(reduceLivePlayerState(state, 'game-command-result', { ...receipt, ...change })).toBe(
          state
        )
      }
      state = reduceLivePlayerState(state, 'game-command-result', receipt)
      expect(state).toMatchObject({
        stateVersion: 9,
        pending: null,
        draft: { text: 'Mars' },
        receipt,
        error: accepted ? null : 'invalid-answer',
        leaderboard: [{ playerId: 'peer', score: 10 }],
      })
      expect(reduceLivePlayerState(state, 'game-round-state', snapshot({ stateVersion: 8 }))).toBe(
        state
      )
    }
  )
})
