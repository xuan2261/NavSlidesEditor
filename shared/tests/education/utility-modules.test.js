import { describe, expect, it } from 'vitest'
import { createUtilityConfig } from '../../src/education/utility-config.js'
import { createLuckyWheelState, reduceLuckyWheel } from '../../src/education/lucky-wheel-state.js'
import { createCountdownState, reduceCountdown } from '../../src/education/countdown-state.js'
import { createScoreboardState, reduceScoreboard } from '../../src/education/scoreboard-state.js'
import { createInteractionVariableStore } from '../../src/education/interaction-variables.js'

const wheel = (patch) =>
  createUtilityConfig('lucky-wheel', {
    items: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', weight: 3 },
    ],
    ...patch,
  })
const timer = (patch) => createUtilityConfig('countdown', { durationSeconds: 5, ...patch })
const board = (patch) =>
  createUtilityConfig('scoreboard', {
    teams: [{ id: 'a', name: 'A', color: '#123456', initialScore: 0.5 }],
    step: 0.5,
    minScore: -1,
    maxScore: 1,
    ...patch,
  })

describe('atomic weighted utility wheel', () => {
  it('uses weighted cumulative boundaries and removes exactly one ID per spin', () => {
    const config = wheel(),
      before = structuredClone(config)
    let state = createLuckyWheelState(config)
    state = reduceLuckyWheel(config, state, { type: 'spin' }, { random: () => 0.25 })
    expect(state.result).toEqual({ id: 'b', label: 'B' })
    expect(state.poolIds).toEqual(['a'])
    expect(reduceLuckyWheel(config, state, { type: 'spin' }, { random: () => 0 })).toBe(state)
    state = reduceLuckyWheel(config, state, { type: 'finish', turn: state.turn })
    state = reduceLuckyWheel(config, state, { type: 'spin' }, { random: () => 0.9999 })
    expect(state.result.id).toBe('a')
    state = reduceLuckyWheel(config, state, { type: 'finish', turn: state.turn })
    expect(state.phase).toBe('exhausted')
    expect(reduceLuckyWheel(config, state, { type: 'spin' })).toBe(state)
    expect(config).toEqual(before)
  })
  it('replays original pool and rejects stale animation completion', () => {
    const config = wheel(),
      initial = createLuckyWheelState(config)
    const spinning = reduceLuckyWheel(config, initial, { type: 'spin' }, { random: () => 0 })
    const replay = reduceLuckyWheel(config, spinning, { type: 'reset' })
    expect(replay.poolIds).toEqual(['a', 'b'])
    expect(
      reduceLuckyWheel(config, replay, {
        type: 'finish',
        generation: spinning.generation,
        turn: spinning.turn,
      })
    ).toBe(replay)
    expect(initial.poolIds).toEqual(['a', 'b'])
    expect(replay.result).toBeNull()
  })
  it('scales huge weights without overflow and rejects invalid author data', () => {
    const config = wheel({
      items: [
        { id: 'a', label: 'A', weight: Number.MAX_VALUE },
        { id: 'b', label: 'B', weight: Number.MAX_VALUE },
      ],
    })
    expect(
      reduceLuckyWheel(
        config,
        createLuckyWheelState(config),
        { type: 'spin' },
        { random: () => 0.5 }
      ).result.id
    ).toBe('b')
    for (const weight of [0, -1, NaN, Infinity])
      expect(() => wheel({ items: [{ id: 'a', label: 'A', weight }] })).toThrow(/weight/)
    const tiny = wheel({
      items: [
        { id: 'a', label: 'A', weight: Number.MIN_VALUE },
        { id: 'b', label: 'B', weight: Number.MAX_VALUE },
      ],
    })
    expect(
      reduceLuckyWheel(tiny, createLuckyWheelState(tiny), { type: 'spin' }, { random: () => 0 })
        .result.id
    ).toBe('a')
  })
})

describe('deadline countdown transitions', () => {
  it('snapshots pause, resumes from remaining, and expires once after delayed ticks', () => {
    const config = timer()
    let state = createCountdownState(config, { now: () => 100 })
    state = reduceCountdown(config, state, { type: 'start' }, { now: () => 100 })
    expect(reduceCountdown(config, state, { type: 'start' }, { now: () => 1000 })).toBe(state)
    state = reduceCountdown(config, state, { type: 'pause' }, { now: () => 5099 })
    expect(state.remainingMs).toBe(1)
    expect(state.pauseReason).toBe('user')
    expect(reduceCountdown(config, state, { type: 'show' }, { now: () => 10000 })).toBe(state)
    state = reduceCountdown(config, state, { type: 'resume' }, { now: () => 10000 })
    expect(state.deadline).toBe(10001)
    state = reduceCountdown(config, state, { type: 'tick' }, { now: () => 20000 })
    expect(state.phase).toBe('expired')
    expect(state.remainingMs).toBe(0)
    expect(state.expiries).toBe(1)
    expect(reduceCountdown(config, state, { type: 'tick' }, { now: () => 30000 })).toBe(state)
    expect(reduceCountdown(config, state, { type: 'resume' })).toBe(state)
  })
  it('distinguishes lifecycle suspension, stale callbacks, duration drafts and replay', () => {
    const config = timer({ autoStart: true })
    let state = createCountdownState(config, { now: () => 0 })
    state = reduceCountdown(config, state, { type: 'hide' }, { now: () => 1000 })
    expect(state.remainingMs).toBe(4000)
    state = reduceCountdown(config, state, { type: 'show' }, { now: () => 9000 })
    expect(state.deadline).toBe(13000)
    const revision = state.revision
    state = reduceCountdown(config, state, { type: 'reset' }, { now: () => 10000 })
    expect(state.phase).toBe('running')
    expect(state.deadline).toBe(15000)
    expect(reduceCountdown(config, state, { type: 'tick', revision }, { now: () => 20000 })).toBe(
      state
    )
    state = reduceCountdown(
      config,
      state,
      { type: 'duration', durationSeconds: 8 },
      { now: () => 10000 }
    )
    expect(state.phase).toBe('idle')
    expect(state.remainingMs).toBe(8000)
    expect(config.durationSeconds).toBe(5)
    expect(() => reduceCountdown(config, state, { type: 'duration', durationSeconds: 0 })).toThrow(
      /duration/
    )
  })
})

describe('scoreboard local and variable authorities', () => {
  it('clamps decimal scores, rejects unknown teams and keeps saved initial values', () => {
    const config = board(),
      before = structuredClone(config)
    let state = createScoreboardState(config)
    state = reduceScoreboard(config, state, { type: 'change', teamId: 'a', direction: 1 })
    expect(state.scores.a).toBe(1)
    expect(reduceScoreboard(config, state, { type: 'change', teamId: 'a', direction: 1 })).toBe(
      state
    )
    for (let i = 0; i < 8; i++)
      state = reduceScoreboard(config, state, { type: 'change', teamId: 'a', direction: -1 })
    expect(state.scores.a).toBe(-1)
    expect(reduceScoreboard(config, state, { type: 'reset' }).scores.a).toBe(0.5)
    expect(() =>
      reduceScoreboard(config, state, { type: 'change', teamId: 'missing', direction: 1 })
    ).toThrow(/team/)
    expect(config).toEqual(before)
  })
  it('never creates bound shadow scores and subset reset preserves unrelated variables', () => {
    const config = board({ teams: [{ id: 'a', name: 'A', color: '#123456', variableId: 'score' }] })
    const state = createScoreboardState(config)
    expect(state.scores).toEqual({})
    expect(reduceScoreboard(config, state, { type: 'change', teamId: 'a', direction: 1 })).toBe(
      state
    )
    const store = createInteractionVariableStore([
      { id: 'score', name: 'Score', initialValue: 2, min: 0, max: 3 },
      { id: 'other', name: 'Other', initialValue: 5, min: 0, max: 10 },
    ])
    store.change('score', 1)
    store.change('other', 1)
    store.reset(['score'])
    expect(store.getState()).toEqual({ score: 2, other: 6 })
    expect(() => store.reset(['score', 'missing'])).toThrow()
    expect(store.read('other')).toBe(6)
  })
})
