import { describe, it, expect } from 'vitest'
import {
  normalizeGameConfig,
  normalizeGameElement,
} from '../src/education/normalize-game-config.js'
import { validateGameConfig } from '../src/education/game-schema.js'

const legacy = {
  id: 'authored-question',
  question: 'Ready?',
  options: ['Yes', 'No'],
  correctIndex: 0,
}
describe('trivia relational defaults', () => {
  it('contextualizes only default-owned rounds to the authored question list', () => {
    const value = normalizeGameConfig({ gameType: 'trivia-champ', questions: [legacy] })
    expect(value.questions.map((question) => question.id)).toEqual(['authored-question'])
    expect(value.rounds[0].questionIds).toEqual(['authored-question'])
    expect(validateGameConfig('trivia-champ', value).isValid).toBe(true)
    const empty = normalizeGameConfig({ gameType: 'trivia-champ', questions: [] })
    expect(empty.rounds[0].questionIds).toEqual([])
  })
  it('lifts legacy embedded questions without injecting a factory sample', () => {
    const value = normalizeGameConfig({
      gameType: 'trivia-champ',
      rounds: [{ name: 'Authored', questions: [legacy] }],
    })
    expect(value.questions.map((question) => question.id)).toEqual(['authored-question'])
    expect(value.rounds[0].questionIds).toEqual(['authored-question'])
    expect(normalizeGameConfig({ gameType: 'trivia-champ', 'trivia-champ': value })).toEqual(value)
  })
  it('does not contextualize or prune an explicitly authored dangling round reference', () => {
    const element = {
      gameType: 'trivia-champ',
      questions: [legacy],
      rounds: [
        { id: 'r1', name: 'Round', mode: 'individual', timeLimit: 30, questionIds: ['deleted'] },
      ],
    }
    const draft = normalizeGameConfig(element)
    expect(draft.rounds[0].questionIds).toEqual(['deleted'])
    expect(validateGameConfig('trivia-champ', draft).errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ['rounds', 0, 'questionIds', 0] })])
    )
    expect(() => normalizeGameElement(element)).toThrow(/Unknown question/)
  })
})
