import { describe, expect, it } from 'vitest'
import {
  validateCanonicalQuestion,
  normalizeLegacyQuestion,
  createCanonicalQuestion,
} from '../src/education/question-schema.js'

const choice = () => ({
  id: 'q',
  kind: 'single-choice',
  prompt: 'Which?',
  points: 10,
  timeLimit: null,
  options: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
  answerKey: { optionId: 'b' },
  feedback: { correct: 'Yes', incorrect: 'Try again', explanation: 'Because B' },
})
const errors = (question) => validateCanonicalQuestion(question).errors

describe('canonical question boundary', () => {
  it('keeps correctness attached to an option identity after reorder', () => {
    const question = choice()
    question.options.reverse()
    expect(validateCanonicalQuestion(question)).toEqual({ isValid: true, errors: [] })
    question.options.shift()
    expect(errors(question)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['answerKey', 'optionId'] })])
    )
  })

  it.each([
    [
      'duplicate identity',
      (q) => {
        q.options[1].id = 'a'
      },
      ['options', 1, 'id'],
    ],
    [
      'unknown answer reference',
      (q) => {
        q.answerKey.optionId = 'missing'
      },
      ['answerKey', 'optionId'],
    ],
    [
      'blank prompt',
      (q) => {
        q.prompt = '  '
      },
      ['prompt'],
    ],
    [
      'negative points',
      (q) => {
        q.points = -1
      },
      ['points'],
    ],
    [
      'nonfinite points',
      (q) => {
        q.points = Infinity
      },
      ['points'],
    ],
    [
      'short timer',
      (q) => {
        q.timeLimit = 4
      },
      ['timeLimit'],
    ],
    [
      'long timer',
      (q) => {
        q.timeLimit = 301
      },
      ['timeLimit'],
    ],
    [
      'missing feedback',
      (q) => {
        delete q.feedback.explanation
      },
      ['feedback', 'explanation'],
    ],
    [
      'unsafe image',
      (q) => {
        q.media = { src: 'javascript:alert(1)', alt: 'diagram' }
      },
      ['media', 'src'],
    ],
    [
      'unsafe option image',
      (q) => {
        q.options[0].media = { src: 'data:text/html;base64,WA==', alt: 'A' }
      },
      ['options', 0, 'media', 'src'],
    ],
    [
      'video instead of image',
      (q) => {
        q.media = { src: 'data:video/mp4;base64,WA==', alt: 'A' }
      },
      ['media', 'src'],
    ],
    [
      'missing image alt',
      (q) => {
        q.media = { src: '/uploads/a.png' }
      },
      ['media', 'alt'],
    ],
    [
      'extra key marker',
      (q) => {
        q.answerKey.correctIndex = 1
      },
      ['answerKey', 'correctIndex'],
    ],
  ])('rejects %s with an actionable path', (_, change, path) => {
    const question = choice()
    change(question)
    expect(errors(question)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path, message: expect.any(String) })])
    )
  })

  it('accepts zero points, bounded fractional time and safe media without mutation', () => {
    const question = {
      ...choice(),
      points: 0,
      timeLimit: 5.5,
      media: { src: '/uploads/a.png', alt: '' },
    }
    const before = structuredClone(question)
    expect(validateCanonicalQuestion(question)).toEqual({ isValid: true, errors: [] })
    expect(question).toEqual(before)
  })

  it('validates all seven private key shapes and rejects missing references', () => {
    const base = choice()
    const fixtures = [
      { kind: 'multi-choice', answerKey: { optionIds: ['a', 'b'] } },
      { kind: 'true-false', options: undefined, answerKey: { value: false } },
      {
        kind: 'fill-blank',
        options: undefined,
        answerKey: { accepted: ['Hà Nội'], caseSensitive: false },
      },
      { kind: 'ordering', answerKey: { itemIds: ['b', 'a'] } },
      {
        kind: 'matching',
        options: { left: [{ id: 'l', text: 'L' }], right: [{ id: 'r', text: 'R' }] },
        answerKey: { pairs: [{ leftId: 'l', rightId: 'r' }] },
      },
      {
        kind: 'image-hotspot',
        media: { src: '/uploads/map.png', alt: 'Map' },
        options: [
          { id: 'target', text: 'North' },
          { id: 'neutral', text: 'South' },
        ],
        answerKey: { regions: [{ id: 'target', shape: 'rect', x: 0, y: 0, width: 1, height: 1 }] },
      },
    ]
    for (const fixture of fixtures) {
      const question = { ...base, ...fixture }
      if (question.options === undefined) delete question.options
      expect(validateCanonicalQuestion(question)).toEqual({ isValid: true, errors: [] })
    }
    expect(errors({ ...base, kind: 'ordering', answerKey: { itemIds: ['a'] } })).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['answerKey', 'itemIds'] })])
    )
    expect(errors({ ...base, kind: 'multi-choice', answerKey: { optionIds: ['a', 'a'] } })).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['answerKey', 'optionIds'] })])
    )
    const duplicateSides = {
      ...base,
      kind: 'matching',
      options: { left: [{ id: 'same', text: 'L' }], right: [{ id: 'same', text: 'R' }] },
      answerKey: { pairs: [{ leftId: 'same', rightId: 'same' }] },
    }
    expect(errors(duplicateSides)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['options', 'right', 0, 'id'] })])
    )
  })

  it.each([
    { id: 'a', shape: 'rect', x: 0.8, y: 0, width: 0.3, height: 1 },
    { id: 'a', shape: 'circle', cx: 0.1, cy: 0.5, r: 0.2 },
    { id: 'a', shape: 'circle', cx: 0.5, cy: 0.5, r: 0 },
    { id: 'unknown', shape: 'rect', x: 0, y: 0, width: 1, height: 1 },
  ])('rejects unbounded or unknown hotspot regions %j', (region) => {
    const question = {
      ...choice(),
      kind: 'image-hotspot',
      media: { src: '/map.png', alt: 'Map' },
      answerKey: { regions: [region] },
    }
    expect(validateCanonicalQuestion(question).isValid).toBe(false)
  })
})

describe('legacy migration and question factories', () => {
  it('normalizes strings to stable identities and remains idempotent without touching the legacy input', () => {
    const legacy = {
      question: 'Choose B',
      options: ['A', 'B'],
      correctIndex: 1,
      explanation: 'B wins',
    }
    const before = structuredClone(legacy)
    const first = normalizeLegacyQuestion(legacy, 'category-2/question-3')
    expect(first).toEqual({
      id: 'category-2/question-3',
      kind: 'single-choice',
      prompt: 'Choose B',
      points: 10,
      timeLimit: null,
      options: [
        { id: 'category-2/question-3/option-1', text: 'A' },
        { id: 'category-2/question-3/option-2', text: 'B' },
      ],
      answerKey: { optionId: 'category-2/question-3/option-2' },
      feedback: { correct: '', incorrect: '', explanation: 'B wins' },
    })
    expect(normalizeLegacyQuestion(first, 'different-context')).toEqual(first)
    expect(normalizeLegacyQuestion(legacy, 'category-2/question-3')).toEqual(first)
    expect(legacy).toEqual(before)
  })

  it('preserves authored identities, image and legacy grading bounds', () => {
    const legacy = {
      id: 'saved',
      question: 'Choose',
      options: [{ id: 'kept', text: 'One', media: { src: '/one.png', alt: 'One' } }],
      correctIndex: 0,
      points: 2000,
      timeLimit: 999,
    }
    const result = normalizeLegacyQuestion(legacy)
    expect(result).toMatchObject({
      id: 'saved',
      points: 1000,
      timeLimit: 300,
      answerKey: { optionId: 'kept' },
    })
    expect(result.options[0]).toEqual(legacy.options[0])
    expect(normalizeLegacyQuestion({ ...legacy, points: -4, timeLimit: -4 })).toMatchObject({
      points: 1,
      timeLimit: 5,
    })
    expect(normalizeLegacyQuestion({ ...legacy, points: 'bad', timeLimit: 'bad' })).toMatchObject({
      points: 10,
      timeLimit: 30,
    })
    expect(normalizeLegacyQuestion({ ...legacy, points: 12.6, timeLimit: 20.6 })).toMatchObject({
      points: 13,
      timeLimit: 21,
    })
    expect(normalizeLegacyQuestion({ ...legacy, timeLimit: null }).timeLimit).toBeNull()
    expect(normalizeLegacyQuestion({ ...legacy, points: null }).points).toBe(1)
  })

  it.each([-1, 2, 0.5, '1', undefined])('rejects ambiguous legacy index %s', (correctIndex) => {
    const migrate = () =>
      normalizeLegacyQuestion({ question: 'Choose', options: ['A', 'B'], correctIndex })
    expect(migrate).toThrow(/correctIndex/)
    try {
      migrate()
    } catch (error) {
      expect(error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['correctIndex'] })])
      )
    }
  })

  it('does not repair an invalid canonical answer, feedback, timer or duplicate ID', () => {
    for (const change of [
      (q) => {
        q.answerKey.optionId = 'gone'
      },
      (q) => {
        q.options[1].id = 'a'
      },
      (q) => {
        q.timeLimit = 400
      },
      (q) => {
        delete q.feedback
      },
    ]) {
      const question = choice()
      change(question)
      expect(() => normalizeLegacyQuestion(question)).toThrow()
    }
  })

  it('preserves an intentionally blank factory draft and reports its required prompt', () => {
    const draft = createCanonicalQuestion({ id: 'draft', prompt: '' })
    expect(draft.prompt).toBe('')
    expect(errors(draft)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['prompt'] })])
    )
  })

  it('rejects sparse item, accepted-answer and region arrays instead of allowing absent entries', () => {
    const choices = choice()
    choices.options = new Array(2)
    choices.options[1] = { id: 'b', text: 'B' }
    expect(errors(choices)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['options', 0] })])
    )
    const fill = createCanonicalQuestion({
      id: 'fill',
      kind: 'fill-blank',
      answerKey: { accepted: new Array(1), caseSensitive: false },
    })
    expect(errors(fill)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['answerKey', 'accepted'] })])
    )
    const hotspot = createCanonicalQuestion({
      id: 'spot',
      kind: 'image-hotspot',
      answerKey: { regions: new Array(1) },
    })
    expect(errors(hotspot)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['answerKey', 'regions', 0] })])
    )
  })

  it('creates complete independent questions for every kind and preserves overrides without shared mutation', () => {
    const kinds = [
      'single-choice',
      'multi-choice',
      'true-false',
      'fill-blank',
      'ordering',
      'matching',
      'image-hotspot',
    ]
    for (const kind of kinds) {
      const first = createCanonicalQuestion({ kind, id: 'first' })
      const second = createCanonicalQuestion({ kind, id: 'second' })
      expect(validateCanonicalQuestion(first)).toEqual({ isValid: true, errors: [] })
      first.feedback.correct = 'Changed'
      if (Array.isArray(first.options)) first.options[0].text = 'Changed'
      expect(second.feedback.correct).toBe('')
      if (Array.isArray(second.options)) expect(second.options[0].text).not.toBe('Changed')
    }
    const override = { ...choice(), id: 'authored' }
    const created = createCanonicalQuestion(override)
    created.options[0].text = 'Edited'
    expect(override.options[0].text).toBe('A')
    expect(created.answerKey).toEqual({ optionId: 'b' })
  })
})
