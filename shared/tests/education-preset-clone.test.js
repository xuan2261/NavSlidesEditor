import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {
  EDUCATION_PRESETS,
  listEducationPresets,
  cloneEducationPreset,
} = require('../src/education/presets/catalog.js')
const { validateGameConfig } = require('../src/education/game-schema.js')
const { evaluateAnswer } = require('../src/education/answer-evaluator.js')
const { CANONICAL_GAME_TYPES } = require('../src/education/game-registry.js')
const { normalizeGameElement } = require('../src/education/normalize-game-config.js')

const ids = (prefix) => {
  let n = 0
  return () => `${prefix}-${++n}`
}
describe('education presets', () => {
  it('offers valid ready-to-author examples of all native subtypes and all seven quiz question kinds', () => {
    const games = EDUCATION_PRESETS.filter((preset) => preset.gameType)
    expect(games.map((preset) => preset.gameType).sort()).toEqual([...CANONICAL_GAME_TYPES].sort())
    for (const preset of games) {
      const element = cloneEducationPreset(preset, { createId: ids(preset.id) }).elements[0]
      expect(validateGameConfig(element.gameType, element[element.gameType])).toEqual({
        isValid: true,
        errors: [],
      })
    }
    const quiz = games.find((preset) => preset.gameType === 'quiz').elements[0].quiz
    expect(quiz.questions.map((question) => question.kind).sort()).toEqual(
      [
        'single-choice',
        'multi-choice',
        'true-false',
        'fill-blank',
        'ordering',
        'matching',
        'image-hotspot',
      ].sort()
    )
  })
  it.each(EDUCATION_PRESETS.filter((preset) => preset.gameType))(
    'preserves authored $gameType activity data across cloning and persisted normalization',
    (preset) => {
      const element = cloneEducationPreset(preset, { createId: ids(preset.id) }).elements[0]
      const persisted = normalizeGameElement(JSON.parse(JSON.stringify(element)))
      expect(persisted[preset.gameType]).toEqual(element[preset.gameType])
    }
  )
  it('searches both languages and restricts categories without running previews', () => {
    expect(
      listEducationPresets({ search: 'Đồng hồ', locale: 'vi', category: 'utilities' }).map(
        (p) => p.gameType
      )
    ).toEqual(['countdown'])
    expect(listEducationPresets({ search: 'Memory', locale: 'en' }).map((p) => p.gameType)).toEqual(
      ['memory']
    )
    expect(listEducationPresets({ search: 'not a real activity' })).toEqual([])
  })
  it('isolates config edits and remaps owned question and answer references', () => {
    const original = EDUCATION_PRESETS.find((p) => p.gameType === 'quiz')
    const a = cloneEducationPreset(original, { createId: ids('a') }).elements[0]
    const b = cloneEducationPreset(original, { createId: ids('b') }).elements[0]
    const q = a.quiz.questions[0]
    expect(q.id).not.toBe(b.quiz.questions[0].id)
    expect(evaluateAnswer(q, { optionId: q.answerKey.optionId })).toMatchObject({
      valid: true,
      correct: true,
    })
    q.prompt = 'Edited locally'
    expect(b.quiz.questions[0].prompt).toBe(original.elements[0].quiz.questions[0].prompt)
  })
  it('keeps multi-choice, ordering, matching and region answers connected to cloned item identities', () => {
    const config = cloneEducationPreset('education-quiz', { createId: ids('references') })
      .elements[0].quiz
    const answers = {
      'multi-choice': (question) => ({ optionIds: question.answerKey.optionIds }),
      ordering: (question) => ({ itemIds: question.answerKey.itemIds }),
      matching: (question) => ({ pairs: question.answerKey.pairs }),
      'image-hotspot': (question) => ({
        mode: 'region',
        regionId: question.answerKey.regions[0].id,
      }),
    }
    for (const question of config.questions.filter((question) => answers[question.kind])) {
      expect(evaluateAnswer(question, answers[question.kind](question))).toMatchObject({
        valid: true,
        correct: true,
      })
    }
  })
  it('rejects conflicting generated IDs without changing the destination or catalog', () => {
    const destinationElements = [{ id: 'existing', type: 'text', content: 'Keep this lesson' }]
    expect(() =>
      cloneEducationPreset('education-quiz', { createId: () => 'existing', destinationElements })
    ).toThrow('fresh')
    expect(destinationElements).toEqual([
      { id: 'existing', type: 'text', content: 'Keep this lesson' },
    ])
    expect(() => cloneEducationPreset('education-quiz', { createId: () => 'repeated' })).toThrow(
      'unique'
    )
  })
  it('remaps group, connector and visibility references while retaining unresolved external references with warnings', () => {
    const bundle = {
      elements: [
        { id: 'a', groupId: 'g', type: 'text', action: { kind: 'show', targetElementId: 'b' } },
        { id: 'b', groupId: 'g', type: 'text' },
        {
          id: 'wire',
          type: 'line',
          startConnection: { elementId: 'a' },
          endConnection: { elementId: 'b' },
        },
        { id: 'external', type: 'text', action: { kind: 'hide', targetElementId: 'outside' } },
      ],
    }
    const result = cloneEducationPreset(bundle, { createId: ids('copy') })
    const [a, b, wire, external] = result.elements
    expect(a.groupId).toBe(b.groupId)
    expect(a.groupId).not.toBe('g')
    expect(a.action.targetElementId).toBe(b.id)
    expect(wire.startConnection.elementId).toBe(a.id)
    expect(wire.endConnection.elementId).toBe(b.id)
    expect(external.action.targetElementId).toBe('outside')
    expect(result.warnings.map((warning) => warning.targetElementId)).toEqual(['outside'])
  })
  it('keeps sorting answer references connected after cloning', () => {
    const sorting = cloneEducationPreset(
      EDUCATION_PRESETS.find((p) => p.gameType === 'sorting'),
      { createId: ids('sorting') }
    ).elements[0].sorting
    for (const assignment of sorting.answerKey.assignments) {
      expect(sorting.items.some((item) => item.id === assignment.itemId)).toBe(true)
      expect(sorting.buckets.some((bucket) => bucket.id === assignment.bucketId)).toBe(true)
    }
  })
  it('clones persisted subtype identities without remapping external variables or destination collisions', () => {
    const bundle = {
      elements: [
        {
          id: 'game',
          type: 'game',
          gameType: 'quiz',
          quiz: {
            questions: [
              { id: 'q', options: [{ id: 'o', text: 'Choice' }], answerKey: { optionId: 'o' } },
            ],
          },
          scoreboard: { teams: [{ id: 'team', variableId: 'score' }] },
          action: { kind: 'show', targetElementId: 'outside' },
        },
      ],
    }
    const result = cloneEducationPreset(bundle, {
      createId: ids('canonical'),
      destinationElements: [{ id: 'outside', type: 'text' }],
    })
    const copy = result.elements[0]
    expect(copy.quiz.questions[0].id).not.toBe('q')
    expect(copy.quiz.questions[0].answerKey.optionId).toBe(copy.quiz.questions[0].options[0].id)
    expect(copy.scoreboard.teams[0].id).not.toBe('team')
    expect(copy.scoreboard.teams[0].variableId).toBe('score')
    expect(copy.action.targetElementId).toBe('outside')
    expect(copy.action.referenceError).toBeTruthy()
    expect(result.warnings).toHaveLength(1)
  })
})
