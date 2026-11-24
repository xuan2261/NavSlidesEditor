import { describe, it, expect } from 'vitest'
import { normalizeGameConfig } from '../src/education/normalize-game-config.js'
import { validateGameConfig } from '../src/education/game-schema.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'

const cell = (points, id) => ({
  ...(id ? { id } : {}),
  question: `Question ${points}`,
  options: ['Yes', 'No'],
  correctIndex: 0,
  points,
})
const normalizeBoard = (jeopardy) => normalizeGameConfig({ gameType: 'jeopardy', jeopardy })
const errorAt = (type, config, path) => {
  const result = validateGameConfig(type, config)
  expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path })]))
}

describe('game identities and domain constraints', () => {
  it('migrates Jeopardy daily doubles to stable question IDs without a parallel board', () => {
    const value = normalizeBoard({
      categories: [{ title: 'Geography', questions: [cell(100, 'existing'), cell(200)] }],
      dailyDouble: ['0-200'],
    })
    expect(value.dailyDouble).toEqual([value.categories[0].questions[1].id])
    expect(value.questions).toBeUndefined()
    expect(value.categories[0].questions[0].id).toBe('existing')
    expect(normalizeBoard(value)).toEqual(value)
    value.categories.reverse()
    value.categories[0].questions.reverse()
    expect(normalizeBoard(value).dailyDouble).toEqual(value.dailyDouble)
  })

  it('rejects ambiguous duplicate-point daily doubles, missing/null cells and deleted references', () => {
    for (const questions of [[cell(100), cell(100)], [null], [cell(200)]]) {
      expect(() =>
        normalizeBoard({ categories: [{ title: 'A', questions }], dailyDouble: ['0-100'] })
      ).toThrow(/dailyDouble|questions|points/)
    }
    const value = normalizeBoard({
      categories: [{ title: 'A', questions: [cell(100, 'q1')] }],
      dailyDouble: ['q1'],
    })
    value.categories[0].questions = []
    errorAt('jeopardy', value, ['dailyDouble', 0])
  })

  it('does not rewrite ambiguous canonical numeric-looking IDs as legacy keys', () => {
    const value = normalizeBoard({
      categories: [{ id: 'cat', title: 'A', questions: [cell(100, '0-200')] }],
      dailyDouble: ['0-200'],
    })
    expect(value.dailyDouble).toEqual(['0-200'])
  })

  it('preserves deleted numeric-looking canonical references rather than retargeting a cell', () => {
    const value = createDefaultGameConfig('jeopardy')
    value.dailyDouble = ['0-100']
    const draft = normalizeBoard(value)
    expect(draft.dailyDouble).toEqual(['0-100'])
    errorAt('jeopardy', draft, ['dailyDouble', 0])
  })

  it('rejects a populated legacy parallel board instead of discarding authored questions', () => {
    expect(() =>
      normalizeGameConfig({ gameType: 'jeopardy', questions: { '0-100': cell(100) } })
    ).toThrow(/parallel boards|categories/)
    expect(normalizeGameConfig({ gameType: 'jeopardy', questions: {} }).questions).toBeUndefined()
  })

  it('deterministically migrates strings and legacy team/round/category/pair IDs', () => {
    const trivia = {
      gameType: 'trivia-champ',
      teams: ['Blue'],
      questions: [cell(10)],
      rounds: [{ name: 'Round', mode: 'team', questions: [cell(10)] }],
    }
    const a = normalizeGameConfig(trivia)
    expect(a.teams[0].name).toBe('Blue')
    expect(a.rounds[0].questionIds).toEqual([a.questions[1].id])
    expect(a.rounds[0].questions).toBeUndefined()
    expect(normalizeGameConfig(trivia)).toEqual(a)
    const scatter = normalizeGameConfig({
      gameType: 'scattergories',
      categories: ['Food'],
      teams: ['Red'],
    })
    expect(scatter.categories[0]).toEqual({ id: 'scattergories-categories-1', label: 'Food' })
    const matching = normalizeGameConfig({
      gameType: 'matching',
      pairs: [
        { term: 'A', answer: 'B' },
        { prompt: 'C', target: 'D' },
      ],
    })
    expect(matching.pairs[0]).toEqual({
      promptId: 'matching-pairs-1-prompt',
      prompt: 'A',
      targetId: 'matching-pairs-1-target',
      target: 'B',
    })
  })

  it('rejects invalid hex lengths while accepting authored opaque or alpha colors', () => {
    const config = createDefaultGameConfig('relay-race')
    config.teams[0].color = '#12345'
    errorAt('relay-race', config, ['teams', 0, 'color'])
    for (const color of ['#123', '#1234', '#123456', '#12345678']) {
      config.teams[0].color = color
      expect(validateGameConfig('relay-race', config).isValid).toBe(true)
    }
  })

  it('requires corner answers to remain in the authored corner range', () => {
    const value = createDefaultGameConfig('four-corners')
    value.questions[0].options.push({ id: 'fifth', text: 'Fifth' })
    errorAt('four-corners', value, ['questions', 0, 'options'])
  })

  it('validates authored scoreboard score sources and bounds without preserving runtime scores', () => {
    const value = createDefaultGameConfig('scoreboard')
    value.teams[0].initialScore = value.maxScore + 1
    errorAt('scoreboard', value, ['teams', 0, 'initialScore'])
    value.teams[0].initialScore = 3
    value.teams[0].variableId = 'class-points'
    errorAt('scoreboard', value, ['teams', 0, 'initialScore'])
    value.maxScore = value.minScore - 1
    errorAt('scoreboard', value, ['maxScore'])
  })

  it('validates real memory/card content including safe media and authored bounds', () => {
    const value = createDefaultGameConfig('memory')
    value.pairs[0].first = { type: 'image', src: 'javascript:alert(1)', alt: 'Picture' }
    errorAt('memory', value, ['pairs', 0, 'first', 'src'])
    value.mismatchDelayMs = 5001
    errorAt('memory', value, ['mismatchDelayMs'])
    const cards = createDefaultGameConfig('flashcards')
    cards.cards[0].back = { type: 'image', src: '/uploads/picture.png', alt: '' }
    errorAt('flashcards', cards, ['cards', 0, 'back', 'alt'])
  })

  it('checks sorting assignment coverage, unique item references and bucket existence', () => {
    const value = createDefaultGameConfig('sorting')
    value.answerKey.assignments[0].bucketId = 'missing'
    errorAt('sorting', value, ['answerKey', 'assignments', 0, 'bucketId'])
    value.answerKey.assignments[0].bucketId = value.buckets[0].id
    value.answerKey.assignments.pop()
    errorAt('sorting', value, ['answerKey', 'assignments'])
  })

  it('rejects contradictory/parallel/out-of-grid authored crosswords', () => {
    const base = createDefaultGameConfig('crossword')
    const across = {
      id: 'cat',
      answer: 'CAT',
      clue: 'Feline',
      row: 0,
      column: 0,
      direction: 'across',
    }
    const down = { id: 'car', answer: 'CAR', clue: 'Vehicle', row: 0, column: 0, direction: 'down' }
    expect(validateGameConfig('crossword', { ...base, entries: [across, down] }).isValid).toBe(true)
    errorAt('crossword', { ...base, entries: [across, { ...down, answer: 'DOG' }] }, [
      'entries',
      1,
      'answer',
    ])
    errorAt('crossword', { ...base, entries: [across, { ...down, direction: 'across' }] }, [
      'entries',
      1,
      'direction',
    ])
    errorAt('crossword', { ...base, entries: [{ ...across, column: base.columns - 1 }] }, [
      'entries',
      0,
      'column',
    ])
  })

  it('validates Unicode word identities, actual selected-direction capacity and finite seeds', () => {
    const value = createDefaultGameConfig('word-search')
    value.words = [
      { id: 'a', text: 'café' },
      { id: 'b', text: 'cafe\u0301' },
    ]
    errorAt('word-search', value, ['words', 1, 'text'])
    value.words = [{ id: 'a', text: 'ELEPHANT' }]
    value.rows = 2
    value.columns = 10
    value.directions = ['N']
    errorAt('word-search', value, ['words', 0, 'text'])
    value.directions = []
    errorAt('word-search', value, ['directions'])
    value.seed = Infinity
    errorAt('word-search', value, ['seed'])
  })
})
