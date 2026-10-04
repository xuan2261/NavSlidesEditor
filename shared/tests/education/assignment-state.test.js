import { describe, expect, it } from 'vitest'
import {
  createAssignmentState,
  reduceAssignment,
  assignmentAnswer,
  moveOrder,
} from '../../src/education/assignment-state.js'
import { createSortingState, reduceSorting } from '../../src/education/games/sorting.js'
import { createSortingConfig, evaluateSortingAnswer } from '../../src/education/sorting-config.js'
import { createRuntimeSession } from '../../src/education/runtime-session.js'
import { evaluateAnswer } from '../../src/education/answer-evaluator.js'

const shape = { sourceIds: ['a', 'b'], targetIds: ['x', 'y'], bijection: true }
const assign = (state, sourceId, targetId, config = shape) =>
  reduceAssignment(config, state, { type: 'assign', sourceId, targetId })
const fixture = () =>
  createSortingConfig({
    buckets: [
      { id: 'x', label: 'Same' },
      { id: 'y', label: 'Same' },
    ],
    items: [
      { id: 'a', text: 'Same' },
      { id: 'b', text: 'Same' },
    ],
    answerKey: {
      assignments: [
        { itemId: 'a', bucketId: 'x' },
        { itemId: 'b', bucketId: 'x' },
      ],
    },
    attemptLimit: 2,
    points: 7,
  })

describe('immutable stable-ID assignment', () => {
  it('rejects an occupied matching target without swapping or releasing the old assignment', () => {
    const previous = assign(assign(createAssignmentState(), 'a', 'x'), 'b', 'y')
    const next = assign(previous, 'a', 'y')
    expect(next.assignments).toEqual(previous.assignments)
    expect(next.error).toMatch(/occupied/i)
    expect(previous.error).toBeNull()
  })
  it('atomically releases the former target and permits many-to-one only for sorting', () => {
    const first = assign(createAssignmentState(), 'a', 'x')
    const moved = assign(first, 'a', 'y')
    expect(assign(moved, 'b', 'x').assignments).toEqual([
      { sourceId: 'a', targetId: 'y' },
      { sourceId: 'b', targetId: 'x' },
    ])
    expect(assign(first, 'b', 'x', { ...shape, bijection: false }).assignments).toHaveLength(2)
    expect(first.assignments).toEqual([{ sourceId: 'a', targetId: 'x' }])
  })
  it('rejects unknown IDs and stale generations, and clears only the selected source', () => {
    const state = { ...assign(createAssignmentState(), 'a', 'x'), generation: 2 }
    expect(assign(state, 'missing', 'y').assignments).toEqual(state.assignments)
    expect(
      reduceAssignment(shape, state, {
        type: 'assign',
        sourceId: 'a',
        targetId: 'y',
        generation: 1,
      })
    ).toBe(state)
    expect(reduceAssignment(shape, state, { type: 'clear', sourceId: 'a' }).assignments).toEqual([])
    expect(assignmentAnswer(state, 'promptId', 'targetId')).toEqual([
      { promptId: 'a', targetId: 'x' },
    ])
  })
  it('treats unusual IDs as data rather than object keys', () => {
    const config = { sourceIds: ['__proto__'], targetIds: ['constructor'], bijection: true }
    expect(assign(createAssignmentState(), '__proto__', 'constructor', config).assignments).toEqual(
      [{ sourceId: '__proto__', targetId: 'constructor' }]
    )
  })
  it('moves stable ordering IDs without losing or duplicating an item', () => {
    const ids = ['b', 'a', 'c']
    expect(moveOrder(ids, 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveOrder(ids, 'b', -1)).toBe(ids)
    expect(moveOrder(ids, 'unknown', 1)).toBe(ids)
    expect(ids).toEqual(['b', 'a', 'c'])
  })
})

describe('sorting attempts and exact score', () => {
  it('allows wrong, correction, and exactly one award without changing authored config', () => {
    const config = fixture(),
      saved = JSON.stringify(config)
    let state = createSortingState(config)
    const send = (command) => {
      state = reduceSorting(config, state, command)
    }
    send({ type: 'assign', sourceId: 'a', targetId: 'y' })
    send({ type: 'assign', sourceId: 'b', targetId: 'x' })
    send({ type: 'submit' })
    expect(state).toMatchObject({ attempts: 1, score: 0, phase: 'active', feedback: 'incorrect' })
    send({ type: 'assign', sourceId: 'a', targetId: 'x' })
    send({ type: 'submit' })
    expect(state).toMatchObject({ attempts: 2, score: 7, phase: 'complete', feedback: 'correct' })
    const completed = state
    send({ type: 'submit' })
    expect(state).toBe(completed)
    expect(JSON.stringify(config)).toBe(saved)
  })
  it('does not spend an attempt on incomplete answers and locks only after the limit', () => {
    const config = fixture()
    let state = reduceSorting(config, createSortingState(config), { type: 'submit' })
    expect(state.attempts).toBe(0)
    for (const sourceId of ['a', 'b'])
      state = reduceSorting(config, state, { type: 'assign', sourceId, targetId: 'y' })
    state = reduceSorting(config, state, { type: 'submit' })
    state = reduceSorting(config, state, { type: 'submit' })
    expect(state).toMatchObject({ phase: 'exhausted', attempts: 2, score: 0 })
    expect(reduceSorting(config, state, { type: 'assign', sourceId: 'a', targetId: 'x' })).toBe(
      state
    )
  })
  it('resets progress and blocks callbacks from the former session generation', () => {
    const config = fixture()
    const session = createRuntimeSession(
      () => createSortingState(config),
      (state, command) => reduceSorting(config, state, command)
    )
    session.dispatch({ type: 'assign', sourceId: 'a', targetId: 'x' })
    const oldGeneration = session.getState().generation
    session.reset()
    session.dispatch({ type: 'assign', sourceId: 'b', targetId: 'x' }, oldGeneration)
    expect(session.getState()).toMatchObject({
      generation: 1,
      assignment: { assignments: [], selectedId: null },
      attempts: 0,
      score: 0,
    })
    session.destroy()
  })
  it('rejects malformed, duplicate, or unknown submitted item IDs', () => {
    const config = fixture()
    for (const assignments of [
      null,
      [{ itemId: 'a', bucketId: 'x' }],
      [
        { itemId: 'a', bucketId: 'x' },
        { itemId: 'a', bucketId: 'x' },
      ],
      [
        { itemId: 'a', bucketId: 'x' },
        { itemId: 'z', bucketId: 'x' },
      ],
    ]) {
      expect(evaluateSortingAnswer(config, { assignments }).valid).toBe(false)
    }
    expect(
      evaluateSortingAnswer(config, { assignments: [...config.answerKey.assignments].reverse() })
    ).toEqual({ valid: true, correct: true, error: null })
  })
})

describe('ordering answer evaluator boundary', () => {
  const question = {
    id: 'order',
    kind: 'ordering',
    prompt: 'Place the items',
    points: 4,
    timeLimit: null,
    options: [
      { id: 'b', text: 'Same' },
      { id: 'a', text: 'Same' },
    ],
    answerKey: { itemIds: ['a', 'b'] },
    feedback: { correct: '', incorrect: '', explanation: '' },
  }
  it('grades stable IDs despite duplicate labels and shuffled display order', () => {
    expect(
      evaluateAnswer(question, {
        itemIds: moveOrder(
          question.options.map((row) => row.id),
          'a',
          -1
        ),
      })
    ).toEqual({ valid: true, correct: true, error: null })
  })
  it.each([{ itemIds: ['a'] }, { itemIds: ['a', 'a'] }, { itemIds: ['a', 'missing'] }])(
    'rejects nonpermutation %j',
    ({ itemIds }) => {
      expect(evaluateAnswer(question, { itemIds }).valid).toBe(false)
    }
  )
})
