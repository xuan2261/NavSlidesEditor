import { describe, expect, it } from 'vitest'
import { evaluateAnswer } from '../src/education/answer-evaluator.js'

const base = {
  id: 'q',
  prompt: 'Respond',
  points: 10,
  timeLimit: null,
  feedback: { correct: '', incorrect: '', explanation: '' },
}
const items = [
  { id: 'a', text: 'A' },
  { id: 'b', text: 'B' },
  { id: 'c', text: 'C' },
]
const fixtures = [
  [
    'single-choice',
    { options: items, answerKey: { optionId: 'b' } },
    { optionId: 'b' },
    { optionId: 'a' },
    { optionId: 'gone' },
  ],
  [
    'multi-choice',
    { options: items, answerKey: { optionIds: ['a', 'c'] } },
    { optionIds: ['c', 'a'] },
    { optionIds: ['a'] },
    { optionIds: ['a', 'a'] },
  ],
  [
    'true-false',
    { answerKey: { value: true } },
    { value: true },
    { value: false },
    { value: 'true' },
  ],
  [
    'fill-blank',
    { answerKey: { accepted: ['Hà Nội'], caseSensitive: false } },
    { text: '  HÀ NỘI ' },
    { text: 'Ha Noi' },
    { text: 1 },
  ],
  [
    'ordering',
    { options: items, answerKey: { itemIds: ['b', 'a', 'c'] } },
    { itemIds: ['b', 'a', 'c'] },
    { itemIds: ['a', 'b', 'c'] },
    { itemIds: ['b', 'a'] },
  ],
  [
    'matching',
    {
      options: {
        left: items.slice(0, 2),
        right: [
          { id: 'x', text: 'X' },
          { id: 'y', text: 'Y' },
        ],
      },
      answerKey: {
        pairs: [
          { leftId: 'a', rightId: 'x' },
          { leftId: 'b', rightId: 'y' },
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
    {
      media: { src: '/map.png', alt: 'Map' },
      options: [
        { id: 'target', text: 'Target' },
        { id: 'neutral', text: 'Elsewhere' },
      ],
      answerKey: {
        regions: [{ id: 'target', shape: 'rect', x: 0.2, y: 0.2, width: 0.3, height: 0.3 }],
      },
    },
    { mode: 'region', regionId: 'target' },
    { mode: 'region', regionId: 'neutral' },
    { mode: 'region', regionId: 'unknown' },
  ],
]

describe('seven kind answer evaluation', () => {
  it.each(fixtures)(
    'distinguishes correct, wrong and invalid for %s without mutation',
    (kind, fields, correct, wrong, invalid) => {
      const question = { ...base, kind, ...fields }
      const before = structuredClone({ question, correct, wrong, invalid })
      expect(evaluateAnswer(question, correct)).toEqual({ valid: true, correct: true, error: null })
      expect(evaluateAnswer(question, wrong)).toEqual({ valid: true, correct: false, error: null })
      expect(evaluateAnswer(question, invalid)).toEqual({
        valid: false,
        correct: false,
        error: expect.any(String),
      })
      expect({ question, correct, wrong, invalid }).toEqual(before)
    }
  )

  it('treats an empty multi-choice set as a valid wrong answer rather than partial credit', () => {
    const fields = fixtures.find((row) => row[0] === 'multi-choice')[1]
    expect(evaluateAnswer({ ...base, kind: 'multi-choice', ...fields }, { optionIds: [] })).toEqual(
      { valid: true, correct: false, error: null }
    )
  })

  it('uses stable identity for choice, multi, ordering and matching after display reorder', () => {
    for (const [kind, fields, correct] of fixtures.filter((row) =>
      ['single-choice', 'multi-choice', 'ordering', 'matching'].includes(row[0])
    )) {
      const question = structuredClone({ ...base, kind, ...fields })
      if (Array.isArray(question.options)) question.options.reverse()
      else {
        question.options.left.reverse()
        question.options.right.reverse()
      }
      expect(evaluateAnswer(question, correct)).toEqual({ valid: true, correct: true, error: null })
    }
  })

  it.each([
    ['single-choice', { optionId: 'b', correct: true }],
    ['multi-choice', { optionIds: ['a', 'gone'] }],
    ['ordering', { itemIds: ['a', 'a', 'c'] }],
    ['matching', { pairs: [{ leftId: 'a', rightId: 'x' }] }],
    [
      'matching',
      {
        pairs: [
          { leftId: 'a', rightId: 'x' },
          { leftId: 'a', rightId: 'y' },
        ],
      },
    ],
    [
      'matching',
      {
        pairs: [
          { leftId: 'a', rightId: 'x', score: 10 },
          { leftId: 'b', rightId: 'y' },
        ],
      },
    ],
    ['true-false', { value: true, optionId: 'a' }],
    ['fill-blank', { text: 'Hà Nội', value: 'Hà Nội' }],
    ['image-hotspot', { mode: 'point', x: -0.1, y: 0.5 }],
    ['image-hotspot', { mode: 'point', x: NaN, y: 0.5 }],
    ['image-hotspot', { mode: 'point', x: 0.3, y: 0.3, regionId: 'target' }],
  ])('rejects malformed or incomplete %s answers %j', (kind, answer) => {
    const fields = fixtures.find((row) => row[0] === kind)[1]
    expect(evaluateAnswer({ ...base, kind, ...fields }, answer)).toMatchObject({
      valid: false,
      correct: false,
      error: expect.any(String),
    })
  })

  it('normalizes Unicode and whitespace, with explicit case sensitivity and significant diacritics', () => {
    const question = {
      ...base,
      kind: 'fill-blank',
      answerKey: { accepted: ['Café'], caseSensitive: true },
    }
    expect(evaluateAnswer(question, { text: ' Café ' }).correct).toBe(true)
    expect(evaluateAnswer(question, { text: 'CAFÉ' })).toEqual({
      valid: true,
      correct: false,
      error: null,
    })
    question.answerKey.caseSensitive = false
    expect(evaluateAnswer(question, { text: 'CAFÉ' }).correct).toBe(true)
    expect(evaluateAnswer(question, { text: 'Cafe' })).toEqual({
      valid: true,
      correct: false,
      error: null,
    })
  })

  it('includes rectangle edges and circle circumference while treating bounded misses as wrong', () => {
    const fields = fixtures.find((row) => row[0] === 'image-hotspot')[1]
    const question = { ...base, kind: 'image-hotspot', ...fields }
    for (const [x, y] of [
      [0.2, 0.2],
      [0.5, 0.5],
      [0.5, 0.2],
    ]) {
      expect(evaluateAnswer(question, { mode: 'point', x, y })).toEqual({
        valid: true,
        correct: true,
        error: null,
      })
    }
    expect(evaluateAnswer(question, { mode: 'point', x: 1, y: 1 })).toEqual({
      valid: true,
      correct: false,
      error: null,
    })
    question.answerKey = { regions: [{ id: 'target', shape: 'circle', cx: 0.5, cy: 0.5, r: 0.25 }] }
    expect(evaluateAnswer(question, { mode: 'point', x: 0.75, y: 0.5 }).correct).toBe(true)
    expect(evaluateAnswer(question, { mode: 'point', x: 0.751, y: 0.5 }).correct).toBe(false)
  })

  it('rejects invalid private questions rather than grading against a repaired key', () => {
    const question = {
      ...base,
      kind: 'single-choice',
      options: items,
      answerKey: { optionId: 'gone' },
    }
    expect(evaluateAnswer(question, { optionId: 'a' })).toMatchObject({
      valid: false,
      correct: false,
      error: expect.stringContaining('answerKey'),
    })
    expect(evaluateAnswer(null, { optionId: 'a' })).toMatchObject({ valid: false, correct: false })
  })
})
