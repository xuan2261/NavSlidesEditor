// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { engine, fixture } from '../../../server/services/game-authority-test-fixture.js'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import {
  createLivePlayerState,
  reduceLivePlayerState,
} from '../../src/education/live-player-state.js'

afterEach(() => engine._reset())
function joinedScatter() {
  const host = fixture(
    'scattergories',
    createDefaultGameConfig('scattergories'),
    'scatter-waiting-admission'
  )
  host.join('learner')
  const snapshot = engine.getPublicState(host.room.gameId, 'learner')
  const state = reduceLivePlayerState(createLivePlayerState(host.room.gameId), 'game-session', {
    ...snapshot,
    playerId: 'learner',
  })
  return { host, state, snapshot }
}
describe('canonical scatter public state admission', () => {
  it('hydrates the actual waiting and reset snapshots before a letter is drawn', () => {
    const { host, snapshot, state } = joinedScatter()
    expect(snapshot.scatter.letter).toBeNull()
    const joined = reduceLivePlayerState(state, 'game-round-state', snapshot)
    expect(joined).toMatchObject({
      hydrated: true,
      phase: 'waiting',
      error: null,
      scatter: { letter: null },
    })
    expect(host.command('game-reset').accepted).toBe(true)
    const reset = engine.getPublicState(host.room.gameId, 'learner')
    expect(reduceLivePlayerState(joined, 'game-round-state', reset)).toMatchObject({
      hydrated: true,
      generation: 1,
      phase: 'waiting',
      error: null,
    })
  })
  it.each([
    ['playing', null],
    ['playing', undefined],
    ['review', null],
    ['active', undefined],
  ])('rejects malformed %s letter %s without hydrating a corrupt frame', (phase, letter) => {
    const { snapshot, state } = joinedScatter()
    const rejected = reduceLivePlayerState(state, 'game-round-state', {
      ...snapshot,
      phase,
      scatter: { ...snapshot.scatter, letter },
    })
    expect(rejected).toMatchObject({ hydrated: false, error: 'Invalid public game state received' })
  })
})
