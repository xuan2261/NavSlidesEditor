import { describe, expect, it } from 'vitest'
import { createGameElement } from '../constants/game-element-types-constants'
import { normalizeGameConfig, evaluateAnswer, validateGameConfig } from 'revealjs-shared'

describe('game element authoring factory', () => {
  it('keeps nested legacy correctness over flat settings and retains unrelated authored element fields', () => {
    const source = {
      name: 'Authored block',
      x: 80,
      questions: [{ question: 'Flat?', options: ['A', 'B'], correctIndex: 0 }],
      'hot-potato': {
        questions: [{ id: 'nested', question: 'Nested?', options: ['No', 'Yes'], correctIndex: 1 }],
      },
    }
    const element = createGameElement('hot-potato', source)
    const config = normalizeGameConfig(element, 'hot-potato')
    expect(element.name).toBe('Authored block')
    expect(element.x).toBe(80)
    expect(element.questions).toBeUndefined()
    expect(config.questions[0].prompt).toBe('Nested?')
    expect(
      evaluateAnswer(config.questions[0], { optionId: config.questions[0].options[1].id })
    ).toMatchObject({ valid: true, correct: true })
    expect(source['hot-potato'].questions[0]).toHaveProperty('correctIndex', 1)
  })

  it('does not share nested teams, questions or media between newly inserted elements', () => {
    const left = createGameElement('quiz')
    const right = createGameElement('quiz')
    const before = structuredClone(right)
    left.quiz.questions[0].prompt = 'Changed only here'
    left.quiz.questions[0].options[0].text = 'Changed option'
    expect(right).toEqual(before)
    expect(left.id).not.toBe(right.id)
  })

  it('rejects unsupported subtype instead of silently inserting another game', () => {
    expect(() => createGameElement('unknown-game')).toThrow()
  })

  it('removes injected runtime scores while preserving authored team identities', () => {
    const element = createGameElement('relay-race', {
      gameStatus: 'finished',
      currentQuestion: 3,
      'relay-race': {
        teams: [{ id: 't1', name: 'Blue', color: '#0000ff', score: 99 }],
        progress: { answers: [1] },
      },
    })
    expect(element.gameStatus).toBeUndefined()
    expect(element.currentQuestion).toBeUndefined()
    expect(element['relay-race'].teams).toEqual([{ id: 't1', name: 'Blue', color: '#0000ff' }])
    expect(element['relay-race'].progress).toBeUndefined()
    expect(validateGameConfig('relay-race', element['relay-race']).isValid).toBe(true)
  })
})
