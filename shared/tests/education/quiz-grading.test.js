import { describe, expect, it } from 'vitest'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createQuizSession, reduceQuizSession } from '../../src/education/quiz-session.js'

const items = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
]
const cases = [
  [
    'single-choice',
    { options: items, answerKey: { optionId: 'a' } },
    { optionId: 'a' },
    { optionId: 'b' },
    { optionId: 'missing' },
  ],
  [
    'multi-choice',
    { options: items, answerKey: { optionIds: ['a', 'b'] } },
    { optionIds: ['b', 'a'] },
    { optionIds: ['a'] },
    { optionIds: ['a', 'a'] },
  ],
  ['true-false', {}, { value: true }, { value: false }, { value: 'true' }],
  [
    'fill-blank',
    { answerKey: { accepted: ['Café'], caseSensitive: false } },
    { text: '  CAFE\u0301  ' },
    { text: 'Cafe' },
    { text: 12 },
  ],
  [
    'ordering',
    { options: items },
    { itemIds: ['a', 'b'] },
    { itemIds: ['b', 'a'] },
    { itemIds: ['a', 'a'] },
  ],
  [
    'matching',
    {
      options: {
        left: items,
        right: [
          { id: 'x', text: 'X' },
          { id: 'y', text: 'Y' },
        ],
      },
    },
    {
      pairs: [
        { leftId: 'b', rightId: 'y' },
        { leftId: 'a', rightId: 'x' },
      ],
    },
    {
      pairs: [
        { leftId: 'a', rightId: 'y' },
        { leftId: 'b', rightId: 'x' },
      ],
    },
    {
      pairs: [
        { leftId: 'a', rightId: 'x' },
        { leftId: 'b', rightId: 'x' },
      ],
    },
  ],
  [
    'image-hotspot',
    {},
    { mode: 'point', x: 0.25, y: 0.75 },
    { mode: 'point', x: 0.1, y: 0.1 },
    { mode: 'point', x: NaN, y: 0.5 },
  ],
]
function submit(state, answer, attemptId = 'attempt') {
  return reduceQuizSession(state, {
    type: 'submit',
    generation: state.generation,
    questionId: state.questionId,
    attemptId,
    answer,
    now: 0,
  })
}

describe('quiz grading through real sessions', () => {
  it.each(cases)(
    '%s awards exact-match points, consumes only valid attempts, and ends once',
    (kind, overrides, correct, wrong, invalid) => {
      const question = createCanonicalQuestion({ id: 'q', kind, points: 25, ...overrides })
      const initial = createQuizSession({ questions: [question], attemptLimit: 2 })
      const rejected = submit(initial, invalid)
      expect(rejected.lastResult).toMatchObject({ accepted: false, valid: false })
      expect(rejected.attempts).toEqual([])
      expect(rejected.score).toBe(0)
      const retry = submit(rejected, wrong, 'wrong')
      expect(retry.lastResult).toMatchObject({
        accepted: true,
        valid: true,
        correct: false,
        pointsAwarded: 0,
        attemptsUsed: 1,
      })
      expect(retry.status).toBe('active')
      const finished = submit(retry, correct, 'correct')
      expect(finished.lastResult).toMatchObject({
        correct: true,
        pointsAwarded: 25,
        attemptsUsed: 2,
        terminal: true,
      })
      expect(finished.score).toBe(25)
      expect(finished.status).toBe('terminal')
      const extra = submit(finished, correct, 'extra')
      expect(extra.score).toBe(25)
      expect(extra.attempts).toHaveLength(2)
      expect(extra.lastResult.error).toBe('question-ended')
    }
  )

  it('requires full multi-choice sets and rejects unknown items', () => {
    const question = createCanonicalQuestion({
      id: 'q',
      kind: 'multi-choice',
      options: items,
      answerKey: { optionIds: ['a'] },
    })
    const initial = createQuizSession({ questions: [question], attemptLimit: 2 })
    expect(submit(initial, { optionIds: ['a', 'b'] }).lastResult.correct).toBe(false)
    expect(submit(initial, { optionIds: ['missing'] }).attempts).toEqual([])
  })

  it('preserves ID-based answer meaning after reordering options', () => {
    const question = createCanonicalQuestion({
      id: 'q',
      options: items,
      answerKey: { optionId: 'a' },
    })
    question.options.reverse()
    const state = createQuizSession(JSON.parse(JSON.stringify({ questions: [question] })))
    expect(submit(state, { optionId: 'a' }).score).toBe(10)
  })

  it('accepts hotspot keyboard region alternatives and inclusive circle edges', () => {
    const question = createCanonicalQuestion({ id: 'q', kind: 'image-hotspot' })
    question.answerKey.regions = [
      { id: question.options[0].id, shape: 'circle', cx: 0.5, cy: 0.5, r: 0.25 },
    ]
    const initial = createQuizSession({ questions: [question] })
    expect(submit(initial, { mode: 'region', regionId: question.options[0].id }).score).toBe(10)
    expect(submit(initial, { mode: 'point', x: 0.75, y: 0.5 }).score).toBe(10)
    expect(submit(initial, { mode: 'point', x: 1.1, y: 0.5 }).attempts).toEqual([])
  })

  it('respects case-sensitive Unicode text without removing accents', () => {
    const question = createCanonicalQuestion({
      id: 'q',
      kind: 'fill-blank',
      answerKey: { accepted: ['Café'], caseSensitive: true },
    })
    const state = createQuizSession({ questions: [question] })
    expect(submit(state, { text: 'Cafe\u0301' }).score).toBe(10)
    expect(submit(state, { text: 'café' }).score).toBe(0)
  })
})
