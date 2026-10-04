import { describe, expect, it, vi } from 'vitest'
import { mountLivePlayer, createLivePlayerState, reduceLivePlayerState } from 'revealjs-shared'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
describe('monotonic live learner deadline', () => {
  it('never restarts remaining time on receipt, draft or disconnect and reanchors on hydration', () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    document.body.append(root)
    let now = 0,
      state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
        ...E,
        gameType: 'jeopardy',
      })
    state = reduceLivePlayerState(state, 'game-round-state', {
      ...E,
      stateVersion: 1,
      gameType: 'jeopardy',
      phase: 'active',
      timeRemainingMs: 10000,
    })
    const listeners = new Set()
    const transport = {
      getSnapshot: () => state,
      emit: () => false,
      subscribe: (fn) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    }
    const receive = (event, data) => {
      state = reduceLivePlayerState(state, event, data)
      listeners.forEach((fn) => fn(state))
    }
    const mounted = mountLivePlayer(root, { transport, clock: { now: () => now } })
    try {
      now = 4000
      vi.advanceTimersByTime(250)
      expect(root.textContent).toContain('6 seconds')
      receive('pending', { commandId: 'c' })
      receive('game-command-result', {
        ...E,
        stateVersion: 2,
        commandId: 'c',
        accepted: false,
        error: 'invalid-answer',
      })
      expect(root.textContent).toContain('6 seconds')
      receive('disconnect')
      now = 6000
      vi.advanceTimersByTime(250)
      expect(root.textContent).toContain('4 seconds')
      receive('game-round-state', {
        ...E,
        stateVersion: 2,
        gameType: 'jeopardy',
        phase: 'active',
        timeRemainingMs: 3000,
      })
      expect(root.textContent).toContain('3 seconds')
      receive('game-round-state', {
        ...E,
        stateVersion: 2,
        gameType: 'jeopardy',
        phase: 'active',
        timeRemainingMs: 7000,
      })
      expect(root.textContent).toContain('3 seconds')
      now = 7000
      vi.advanceTimersByTime(250)
      expect(root.textContent).toContain('2 seconds')
      receive('game-round-state', {
        ...E,
        roundId: 2,
        stateVersion: 3,
        gameType: 'jeopardy',
        phase: 'active',
        timeRemainingMs: 10000,
      })
      expect(root.textContent).toContain('10 seconds')
    } finally {
      mounted.destroy()
      root.remove()
      vi.useRealTimers()
    }
  })
})
