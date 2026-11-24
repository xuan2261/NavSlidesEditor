import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createPresentationSchema, updatePresentationSchema } = require('./schemas')

const canonical = {
  id: 'q1',
  kind: 'single-choice',
  prompt: 'Capital?',
  points: 10,
  timeLimit: 30,
  options: [
    { id: 'o1', text: 'Paris' },
    { id: 'o2', text: 'London' },
  ],
  answerKey: { optionId: 'o1' },
  feedback: { correct: '', incorrect: '', explanation: '' },
}
const game = (config) => ({
  id: 'game1',
  type: 'game',
  gameType: 'hot-potato',
  'hot-potato': config,
})
const deck = (element) => ({
  title: 'Schema admission',
  slides: [{ id: 'slide1', elements: [element] }],
})

describe('game deck admission', () => {
  it.each([createPresentationSchema, updatePresentationSchema])(
    'rejects dangling correctness instead of saving a broken question',
    (schema) => {
      const question = { ...canonical, answerKey: { optionId: 'removed' } }
      const result = schema.safeParse(deck(game({ questions: [question] })))
      expect(result.success).toBe(false)
      expect(result.error.issues.some((issue) => issue.path.includes('answerKey'))).toBe(true)
    }
  )

  it('removes runtime state without losing authored content from parent, child and layout elements', () => {
    const injected = {
      ...game({ questions: [canonical], currentQuestion: 7, answers: ['o1'], remainingTime: 2 }),
      gameStatus: 'finished',
    }
    const value = deck(injected)
    value.slides[0].children = [{ id: 'child', elements: [{ ...injected, id: 'child-game' }] }]
    value.layoutMasters = [
      {
        id: 'layout',
        name: 'Master',
        fixedElements: [{ ...injected, id: 'master-game' }],
        placeholders: [],
      },
    ]
    const saved = createPresentationSchema.parse(value)
    const elements = [
      saved.slides[0].elements[0],
      saved.slides[0].children[0].elements[0],
      saved.layoutMasters[0].fixedElements[0],
    ]
    for (const element of elements) {
      expect(element.gameStatus).toBeUndefined()
      expect(element['hot-potato'].currentQuestion).toBeUndefined()
      expect(element['hot-potato'].answers).toBeUndefined()
      expect(element['hot-potato'].remainingTime).toBeUndefined()
      expect(element['hot-potato'].questions[0]).toEqual(canonical)
    }
    expect(value.slides[0].elements[0].gameStatus).toBe('finished')
  })

  it('migrates legacy flat/nested fields using nested correctness and remains idempotent', () => {
    const element = {
      ...game({
        questions: [
          { id: 'nested', question: 'Nested', options: ['Wrong', 'Right'], correctIndex: 1 },
        ],
      }),
      questions: [{ id: 'flat', question: 'Flat', options: ['A', 'B'], correctIndex: 0 }],
    }
    const saved = createPresentationSchema.parse(deck(element))
    const question = saved.slides[0].elements[0]['hot-potato'].questions[0]
    expect(question.prompt).toBe('Nested')
    expect(question.answerKey).toEqual({ optionId: question.options[1].id })
    expect(saved.slides[0].elements[0].questions).toBeUndefined()
    expect(question.correctIndex).toBeUndefined()
    expect(createPresentationSchema.parse(saved)).toEqual(saved)
  })

  it('keeps unrelated plugin data while rejecting unknown game subtype', () => {
    const plugin = {
      id: 'plugin1',
      type: 'plugin:diagram',
      payload: { gameStatus: 'authored', score: 17 },
    }
    expect(createPresentationSchema.parse(deck(plugin)).slides[0].elements[0].payload).toEqual(
      plugin.payload
    )
    expect(
      createPresentationSchema.safeParse(deck({ id: 'g', type: 'game', gameType: 'unknown' }))
        .success
    ).toBe(false)
  })
})
