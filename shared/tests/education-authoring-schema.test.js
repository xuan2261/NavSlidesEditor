import { describe, it, expect } from 'vitest'
import { CANONICAL_GAME_TYPES, isGameSubtype } from '../src/education/game-registry.js'
import { createDefaultGameConfig, cloneGameConfig } from '../src/education/game-defaults.js'
import { validateGameConfig } from '../src/education/game-schema.js'
import {
  normalizeGameConfig,
  normalizeGameElement,
} from '../src/education/normalize-game-config.js'

const legacy = (id = 'question') => ({
  id,
  question: 'Capital of France?',
  options: ['Paris', 'Rome'],
  correctIndex: 0,
  points: 100,
})
const invalidAt = (type, config, path) => {
  const result = validateGameConfig(type, config)
  expect(result.isValid).toBe(false)
  expect(result.errors.some((error) => JSON.stringify(error.path) === JSON.stringify(path))).toBe(
    true
  )
}

describe('shared game persistence contracts', () => {
  it('rejects unknown and inherited-property subtypes before creating configuration', () => {
    expect(isGameSubtype('all')).toBe(false)
    expect(isGameSubtype('__proto__')).toBe(false)
    expect(() => createDefaultGameConfig('not-a-game')).toThrow(/game/i)
  })

  it.each(CANONICAL_GAME_TYPES)(
    '%s creates complete valid defaults that cannot share authored mutations',
    (type) => {
      const first = createDefaultGameConfig(type)
      const second = createDefaultGameConfig(type)
      expect(validateGameConfig(type, first)).toEqual({ isValid: true, errors: [] })
      const before = cloneGameConfig(second)
      first.title = 'Changed title'
      const collection = Object.values(first).find(Array.isArray)
      if (collection?.length && typeof collection[0] === 'object') collection[0].id = 'changed'
      expect(second).toEqual(before)
    }
  )

  it('merges authored flat and nested values before defaults, including explicit zero', () => {
    const value = normalizeGameConfig({
      gameType: 'trivia-champ',
      buzzPoints: 3,
      'trivia-champ': { buzzPoints: 0, lightningRound: { timePerQ: 20 } },
    })
    expect(value.buzzPoints).toBe(0)
    expect(value.lightningRound).toEqual({ enabled: false, timePerQ: 20 })
    expect(normalizeGameConfig({ gameType: 'trivia-champ', 'trivia-champ': {} }).buzzPoints).toBe(
      10
    )
    const picker = normalizeGameConfig({
      gameType: 'name-picker',
      items: ['Flat'],
      'name-picker': { items: ['Nested'], weighted: true },
    })
    expect(picker.items).toEqual([{ id: 'name-picker-items-1', label: 'Nested', weight: 1 }])
  })

  it('projects exact transients, normalizes inactive subtypes, and preserves unrelated data', () => {
    const element = {
      id: 'base-id',
      type: 'game',
      gameType: 'hot-potato',
      title: 'Flat title',
      x: 25,
      pluginData: { score: 17, answers: ['authored'] },
      customSetting: true,
      gameStatus: 'active',
      'hot-potato': {
        questions: [legacy()],
        currentQuestion: 2,
        answers: ['a'],
        teacherNote: { score: 9 },
      },
      'name-picker': { items: ['Alice'], exclusions: ['Alice'], customData: { answers: ['keep'] } },
      scoreboard: {
        teams: [{ id: 't1', name: 'A', color: '#ff0000', initialScore: 7, score: 99 }],
        step: 2,
      },
    }
    const before = cloneGameConfig(element)
    const clean = normalizeGameElement(element)
    expect(element).toEqual(before)
    expect(clean.pluginData).toEqual(element.pluginData)
    expect(clean.customSetting).toBe(true)
    expect(clean.x).toBe(25)
    expect(clean.title).toBeUndefined()
    expect(clean.gameStatus).toBeUndefined()
    expect(clean['hot-potato'].title).toBe('Flat title')
    expect(clean['hot-potato'].currentQuestion).toBeUndefined()
    expect(clean['hot-potato'].teacherNote).toEqual({ score: 9 })
    expect(clean['name-picker'].items[0].label).toBe('Alice')
    expect(clean['name-picker'].exclusions).toBeUndefined()
    expect(clean['name-picker'].customData).toEqual({ answers: ['keep'] })
    expect(clean.scoreboard.teams[0]).toEqual({
      id: 't1',
      name: 'A',
      color: '#ff0000',
      initialScore: 7,
    })
    expect(normalizeGameElement(clean)).toEqual(clean)
  })

  it('removes exact question runtime transients without touching authored grading content', () => {
    const config = createDefaultGameConfig('quiz')
    const expected = cloneGameConfig(config.questions[0])
    Object.assign(config.questions[0], {
      answers: ['a'],
      progress: 1,
      remainingTime: 3,
      exclusions: [],
      reveals: [],
      scores: {},
      gameStatus: 'active',
    })
    const clean = normalizeGameElement({ gameType: 'quiz', quiz: config })
    expect(clean.quiz.questions[0]).toEqual(expected)
    const board = createDefaultGameConfig('jeopardy')
    board.categories[0].questions[0].progress = 2
    expect(
      normalizeGameElement({ gameType: 'jeopardy', jeopardy: board }).jeopardy.categories[0]
        .questions[0].progress
    ).toBeUndefined()
  })

  it('preserves IDs and grading keys when canonical questions/options reorder', () => {
    const config = normalizeGameConfig({ gameType: 'hot-potato', questions: [legacy('existing')] })
    const originalKey = cloneGameConfig(config.questions[0].answerKey)
    config.questions[0].options.reverse()
    const again = normalizeGameConfig({ gameType: 'hot-potato', 'hot-potato': config })
    expect(again.questions[0].id).toBe('existing')
    expect(again.questions[0].answerKey).toEqual(originalKey)
    expect(validateGameConfig('hot-potato', again).isValid).toBe(true)
    again.questions[0].options = again.questions[0].options.filter(
      (option) => option.id !== originalKey.optionId
    )
    invalidAt('hot-potato', again, ['questions', 0, 'answerKey', 'optionId'])
  })

  it('does not silently replace malformed authored collections or nested data', () => {
    for (const [type, field] of [
      ['hot-potato', 'questions'],
      ['name-picker', 'items'],
      ['trivia-champ', 'rounds'],
      ['matching', 'pairs'],
    ]) {
      expect(() => normalizeGameConfig({ gameType: type, [type]: { [field]: null } })).toThrow(
        new RegExp(field)
      )
    }
    expect(() => normalizeGameConfig({ gameType: 'poll', poll: [] })).toThrow(/poll/)
    const draft = normalizeGameConfig({
      gameType: 'name-picker',
      items: [{ id: 'a', label: 'A', weight: 0 }],
    })
    invalidAt('name-picker', draft, ['items', 0, 'weight'])
    expect(() => normalizeGameElement({ gameType: 'name-picker', 'name-picker': draft })).toThrow(
      /weight/
    )
  })

  it('rejects duplicate canonical identities and references with useful paths', () => {
    const config = createDefaultGameConfig('trivia-champ')
    config.rounds[0].questionIds = ['missing']
    invalidAt('trivia-champ', config, ['rounds', 0, 'questionIds', 0])
    config.rounds[0].questionIds = [config.questions[0].id]
    config.teams.push(cloneGameConfig(config.teams[0]))
    invalidAt('trivia-champ', config, ['teams', 2, 'id'])
    const poll = createDefaultGameConfig('poll')
    poll.options.push(cloneGameConfig(poll.options[0]))
    invalidAt('poll', poll, ['options', 2, 'id'])
  })

  it('keeps invalid canonical drafts editable while strict element admission rejects them', () => {
    const draft = createDefaultGameConfig('trivia-champ')
    draft.questions[0].prompt = ''
    draft.questions[0].options = draft.questions[0].options.filter(
      (option) => option.id !== draft.questions[0].answerKey.optionId
    )
    draft.rounds[0].questionIds = ['deleted']
    draft.teams[0].name = ''
    const normalized = normalizeGameConfig({ gameType: 'trivia-champ', 'trivia-champ': draft })
    expect(normalized.questions[0].prompt).toBe('')
    expect(normalized.questions[0].answerKey).toEqual(draft.questions[0].answerKey)
    expect(normalized.rounds[0].questionIds).toEqual(['deleted'])
    invalidAt('trivia-champ', normalized, ['questions', 0, 'prompt'])
    invalidAt('trivia-champ', normalized, ['rounds', 0, 'questionIds', 0])
    expect(() =>
      normalizeGameElement({ gameType: 'trivia-champ', 'trivia-champ': normalized })
    ).toThrow(/prompt|deleted|Unknown question/)
    const board = createDefaultGameConfig('jeopardy')
    board.dailyDouble = [board.categories[0].questions[0].id]
    board.categories[0].questions = []
    expect(normalizeGameConfig({ gameType: 'jeopardy', jeopardy: board }).dailyDouble).toEqual(
      board.dailyDouble
    )
    expect(() => normalizeGameElement({ gameType: 'jeopardy', jeopardy: board })).toThrow(
      /dailyDouble/
    )
  })

  it('enforces the current live option bounds rather than silently truncating', () => {
    for (const [field, limit] of [
      ['maxPhraseLength', 40],
      ['maxSubmissionsPerPlayer', 5],
      ['displayLimit', 50],
    ]) {
      invalidAt('word-cloud', { ...createDefaultGameConfig('word-cloud'), [field]: limit + 1 }, [
        field,
      ])
    }
    const poll = createDefaultGameConfig('poll')
    poll.options = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, text: `Choice ${i}` }))
    invalidAt('poll', poll, ['options'])
    const matching = createDefaultGameConfig('matching')
    matching.pairs[1].targetId = matching.pairs[0].targetId
    invalidAt('matching', matching, ['pairs', 1, 'targetId'])
  })
})
