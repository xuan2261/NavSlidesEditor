import { describe, expect, it } from 'vitest'
import { CANONICAL_GAME_TYPES } from '../src/education/game-registry.js'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import {
  projectPublicGameConfig,
  validatePublicGameConfig,
} from '../src/education/game-public-projection.js'

const secret = 'teacher-only-261002'
function privateConfig(type) {
  const config = createDefaultGameConfig(type)
  config.teacherNote = secret
  config.inactiveSubtype = { answerKey: secret }
  for (const question of [
    ...(config.questions || []),
    ...(config.categories || []).flatMap((category) => category.questions || []),
  ]) {
    question.feedback = { correct: secret, incorrect: secret, explanation: secret }
  }
  for (const team of config.teams || []) team.hostCapability = secret
  if (type === 'matching') config.pairs[0].target = secret
  if (type === 'memory') config.pairs[0].second.text = secret
  if (type === 'flashcards') config.cards[0].back.text = secret
  return config
}

describe('explicit audience configuration boundary', () => {
  it.each(CANONICAL_GAME_TYPES)(
    'projects only admitted public %s data without private defaults or mutation',
    (type) => {
      const source = privateConfig(type),
        before = structuredClone(source)
      const publicConfig = projectPublicGameConfig(type, source)
      expect(validatePublicGameConfig(type, publicConfig)).toEqual({ isValid: true, errors: [] })
      expect(JSON.stringify(publicConfig)).not.toContain(secret)
      expect(source).toEqual(before)
      if (publicConfig.questions)
        for (const question of publicConfig.questions) {
          expect(question).not.toHaveProperty('answerKey')
          expect(question).not.toHaveProperty('feedback')
        }
    }
  )
  it('does not disclose matching associations, card answer backs, sorting keys or crossword answers', () => {
    expect(projectPublicGameConfig('matching', privateConfig('matching'))).not.toHaveProperty(
      'pairs'
    )
    expect(projectPublicGameConfig('memory', privateConfig('memory'))).not.toHaveProperty('pairs')
    const flashcards = projectPublicGameConfig('flashcards', privateConfig('flashcards'))
    expect(flashcards.cards[0]).toEqual({
      id: 'card-1',
      front: { type: 'text', text: 'Capital of France?' },
    })
    expect(projectPublicGameConfig('sorting', privateConfig('sorting'))).not.toHaveProperty(
      'answerKey'
    )
    expect(
      projectPublicGameConfig('crossword', privateConfig('crossword')).entries[0]
    ).not.toHaveProperty('answer')
  })
  it('rejects private fields at admitted nested depths rather than silently dropping them in a received payload', () => {
    const quiz = projectPublicGameConfig('quiz', privateConfig('quiz'))
    quiz.questions[0].options[0].hostCapability = secret
    expect(validatePublicGameConfig('quiz', quiz).isValid).toBe(false)
    const trivia = projectPublicGameConfig('trivia-champ', privateConfig('trivia-champ'))
    trivia.rounds[0].answerKey = secret
    expect(validatePublicGameConfig('trivia-champ', trivia).isValid).toBe(false)
    const picker = projectPublicGameConfig('name-picker', privateConfig('name-picker'))
    picker.items[0].feedback = secret
    expect(validatePublicGameConfig('name-picker', picker).isValid).toBe(false)
  })
  it('returns actionable validation errors for a malformed received question collection', () => {
    const cfg = projectPublicGameConfig('hot-potato', privateConfig('hot-potato'))
    cfg.questions = { answerKey: secret }
    expect(validatePublicGameConfig('hot-potato', cfg)).toMatchObject({
      isValid: false,
      errors: [{ path: ['questions'] }],
    })
  })
  it('never fills private grading defaults for missing or malformed public questions', () => {
    expect(validatePublicGameConfig('quiz', { title: 'Public only' }).isValid).toBe(false)
    const cfg = projectPublicGameConfig('quiz', privateConfig('quiz'))
    cfg.questions[0].answerKey = { optionId: 'question-1-option-1' }
    expect(validatePublicGameConfig('quiz', cfg).isValid).toBe(false)
    expect(() => projectPublicGameConfig('not-a-game', {})).toThrow(/subtype/)
  })
})
