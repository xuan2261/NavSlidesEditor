import { describe, expect, it, vi } from 'vitest'
import variables from '../../src/education/interaction-variables.js'
import actions from '../../src/education/interaction-actions.js'
const { normalizeInteractionVariables, createInteractionVariableStore } = variables
const {
  normalizeInteractionAction,
  createInteractionSlideState,
  isInteractionElementVisible,
  reduceInteractionAction,
  executeInteractionAction,
} = actions
const definition = { id: 'score', name: 'Class score', initialValue: 2, min: -5, max: 10 }
const slide = {
  id: 'parent',
  elements: [
    { id: 'answer', initialVisibility: 'hidden' },
    { id: 'button' },
    { id: 'omitted', hidden: true },
  ],
}
const score = (kind, amount) => ({ kind, variableId: 'score', amount })

describe('bounded interaction variables', () => {
  it('admits 32 unique definitions and rejects 33, duplicate IDs and unsupported fields', () => {
    const defs = Array.from({ length: 32 }, (_, i) => ({ ...definition, id: `v${i}` }))
    expect(normalizeInteractionVariables(defs).variables).toEqual(defs)
    for (const bad of [
      [...defs, { ...definition }],
      [definition, definition],
      [{ ...definition, expression: '1+1' }],
    ]) {
      expect(normalizeInteractionVariables(bad).variables).toBeNull()
    }
  })
  it.each([NaN, Infinity, -Infinity, '2', null, 1_000_000_001])(
    'rejects malformed numeric initial value %s',
    (initialValue) => {
      expect(normalizeInteractionVariables([{ ...definition, initialValue }]).variables).toBeNull()
    }
  )
  it.each([
    { min: 3 },
    { max: 1 },
    { min: -1_000_000_001 },
    { max: Infinity },
    { name: '<b>Score</b>' },
  ])('rejects invalid bounds and names %j', (patch) => {
    expect(normalizeInteractionVariables([{ ...definition, ...patch }]).error).not.toBe('')
  })
  it('clamps decimal changes and notifies subscribers with actual immutable score', () => {
    const store = createInteractionVariableStore([definition]),
      listener = vi.fn()
    const stop = store.subscribe(listener)
    expect(store.change('score', 0.5)).toBe(2.5)
    expect(listener).toHaveBeenLastCalledWith({ score: 2.5 })
    expect(store.change('score', 100)).toBe(10)
    expect(store.change('score', -100)).toBe(-5)
    expect(Object.isFrozen(store.getState())).toBe(true)
    stop()
    store.reset()
    expect(store.read('score')).toBe(2)
    expect(listener).toHaveBeenCalledTimes(3)
  })
  it('cannot change undeclared variables or apply nonfinite/excessive deltas', () => {
    const store = createInteractionVariableStore([definition])
    expect(() => store.change('other', 1)).toThrow(/declared/)
    for (const delta of [NaN, Infinity, 1_000_000_001, '1'])
      expect(() => store.change('score', delta)).toThrow(/delta/)
    expect(store.read('score')).toBe(2)
    store.destroy()
    expect(() => store.change('score', 1)).toThrow(/destroyed/)
  })
  it('applies a full canonical scoreboard step atomically while keeping click actions bounded', () => {
    const store = createInteractionVariableStore([
      { ...definition, initialValue: 0, min: -1e9, max: 1e9 },
    ])
    const values = [],
      stop = store.subscribe((value) => values.push(value.score))
    expect(store.change('score', 1e9)).toBe(1e9)
    expect(values).toEqual([1e9])
    expect(normalizeInteractionAction(score('score-add', 1e9)).action).toBeNull()
    expect(store.change('score', -1e9)).toBe(0)
    expect(values).toEqual([1e9, 0])
    stop()
    store.destroy()
  })
  it('supports prototype-looking IDs without prototype inheritance', () => {
    const store = createInteractionVariableStore([{ ...definition, id: '__proto__' }])
    expect(store.change('__proto__', 1)).toBe(3)
    expect(() => store.read('toString')).toThrow(/declared/)
  })
})

describe('six scoped interaction actions', () => {
  it.each([0, -1, NaN, Infinity, '1', 1_000_001])('rejects invalid score amount %s', (amount) => {
    expect(normalizeInteractionAction(score('score-add', amount)).action).toBeNull()
  })
  it('rejects eval, selector and incompatible fields', () => {
    for (const payload of [
      { kind: 'eval', script: 'alert(1)' },
      { kind: 'show', targetElementId: 'answer', selector: '#answer' },
      { ...score('score-add', 1), resetVariables: true },
      { kind: 'reset-slide', resetVariables: 'true' },
    ]) {
      expect(normalizeInteractionAction(payload).action).toBeNull()
    }
  })
  it('requires both fragment and trigger gates, preserving unrelated activity state', () => {
    let state = { ...createInteractionSlideState(slide), activity: { completed: true } }
    state = reduceInteractionAction(state, { kind: 'show', targetElementId: 'answer' }).state
    expect(isInteractionElementVisible(state, 'answer', false)).toBe(false)
    expect(isInteractionElementVisible(state, 'answer', true)).toBe(true)
    state = reduceInteractionAction(state, { kind: 'hide', targetElementId: 'answer' }).state
    expect(isInteractionElementVisible(state, 'answer', true)).toBe(false)
    expect(state.activity).toEqual({ completed: true })
    state = reduceInteractionAction(state, { kind: 'toggle', targetElementId: 'answer' }).state
    expect(isInteractionElementVisible(state, 'answer')).toBe(true)
  })
  it('never resolves omitted, child or other-slide targets', () => {
    const state = createInteractionSlideState(slide)
    for (const targetElementId of [
      'omitted',
      'child-answer',
      'other-slide-answer',
      'constructor',
    ]) {
      const result = reduceInteractionAction(state, { kind: 'show', targetElementId })
      expect(result.state).toBe(state)
      expect(result.error).toMatch(/effective slide/)
    }
  })
  it('dispatches both score actions and preserves scores on default slide reset', () => {
    const store = createInteractionVariableStore([definition]),
      onReset = vi.fn()
    let state = createInteractionSlideState(slide)
    state = executeInteractionAction(state, { kind: 'show', targetElementId: 'answer' }).state
    executeInteractionAction(state, score('score-add', 20), { variables: store })
    expect(store.read('score')).toBe(10)
    executeInteractionAction(state, score('score-subtract', 3), { variables: store })
    expect(store.read('score')).toBe(7)
    const other = createInteractionSlideState({ id: 'other', elements: [{ id: 'another' }] })
    state = executeInteractionAction(
      state,
      { kind: 'reset-slide' },
      { variables: store, onReset }
    ).state
    expect(state.visibility).toEqual({ answer: false, button: true })
    expect(state.generation).toBe(1)
    expect(other.generation).toBe(0)
    expect(store.read('score')).toBe(7)
    expect(onReset).toHaveBeenCalledWith(state)
    executeInteractionAction(
      state,
      { kind: 'reset-slide', resetVariables: true },
      { variables: store }
    )
    expect(store.read('score')).toBe(2)
  })
  it('returns actionable errors without changing state when variable lookup fails', () => {
    const state = createInteractionSlideState(slide),
      store = createInteractionVariableStore([definition])
    const result = executeInteractionAction(
      state,
      { kind: 'score-add', variableId: 'missing', amount: 1 },
      { variables: store }
    )
    expect(result.error).toMatch(/declared/)
    expect(result.state).toBe(state)
    expect(store.read('score')).toBe(2)
  })
})

describe('board-bound variable resets', () => {
  it('resets only a validated bound subset and rejects unknown IDs atomically', () => {
    const store = createInteractionVariableStore([
      definition,
      { ...definition, id: 'other', initialValue: 4 },
    ])
    store.change('score', 3)
    store.change('other', 3)
    expect(() => store.reset(['score', 'missing'])).toThrow(/declared/)
    expect(store.getState()).toEqual({ score: 5, other: 7 })
    store.reset(['score', 'score'])
    expect(store.getState()).toEqual({ score: 2, other: 7 })
    store.reset([])
    expect(store.getState()).toEqual({ score: 2, other: 7 })
    store.reset()
    expect(store.getState()).toEqual({ score: 2, other: 4 })
  })
})
