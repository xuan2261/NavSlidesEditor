import { describe, expect, it } from 'vitest'
import { normalizeGameConfig } from '../../src/education/normalize-game-config.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import {
  createTriviaChampState,
  reduceTriviaChamp,
} from '../../src/education/games/trivia-champ.js'
const questions = ['first', 'second', 'third'].map((id) =>
  createCanonicalQuestion({ id, kind: 'true-false', points: 7 })
)
function fixture(overrides = {}) {
  const config = normalizeGameConfig(
    {
      teams: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      questions,
      rounds: [
        { id: 'r1', name: 'Buzz', mode: 'buzzer', questionIds: ['second', 'first'], timeLimit: 30 },
        { id: 'r2', name: 'Team', mode: 'team', questionIds: ['third'], timeLimit: 20 },
      ],
      ...overrides,
    },
    'trivia-champ'
  )
  let state = { ...createTriviaChampState(config), generation: 0 }
  const send = (type, data = {}, now = 0) =>
    (state = reduceTriviaChamp(
      config,
      state,
      {
        type,
        generation: 0,
        turn: state.turn,
        roundId: state.roundId,
        questionId: state.questionId,
        ...data,
      },
      { now: () => now }
    ))
  return {
    config,
    send,
    get state() {
      return state
    },
  }
}
describe('Trivia authored round outcomes', () => {
  it('awards distinct first buzz and answer points, keeps wrong buzz, and advances authored IDs', () => {
    const f = fixture()
    f.send('start')
    expect(f.state.questionId).toBe('second')
    f.send('buzz', { teamId: 'b' })
    expect(f.state.scores.b).toBe(10)
    const buzz = f.state
    expect(f.send('buzz', { teamId: 'b' })).toBe(buzz)
    expect(f.send('buzz', { teamId: 'a' })).toBe(buzz)
    expect(f.send('answer', { teamId: 'a', answer: { value: true } })).toBe(buzz)
    f.send('answer', { teamId: 'b', answer: { value: false } })
    expect(f.state.scores.b).toBe(10)
    const wrong = f.state
    expect(f.send('answer', { teamId: 'b', answer: { value: true } })).toBe(wrong)
    f.send('next')
    expect(f.state.questionId).toBe('first')
    expect(f.state.buzzTeamId).toBe(null)
    f.send('buzz', { teamId: 'a' })
    f.send('answer', { teamId: 'a', answer: { value: true } })
    expect(f.state.scores.a).toBe(17)
    f.send('next')
    expect(f.state.roundId).toBe('r2')
    expect(f.state.questionId).toBe('third')
    f.send('answer', { teamId: 'b', answer: { value: true } })
    f.send('next')
    expect(f.state.phase).toBe('ended')
    expect(f.state.scores).toEqual({ a: 17, b: 17 })
  })
  it('explicit zero disables only buzz scoring and bonus controls are exclusive', () => {
    const f = fixture({
      buzzPoints: 0,
      lightningRound: { enabled: true, timePerQ: 4 },
      jackpotRound: { enabled: true, multiplier: 5 },
    })
    f.send('start')
    f.send('bonus', { mode: 'lightning' })
    expect(f.state.bonus).toBe('lightning')
    f.send('bonus', { mode: 'jackpot' })
    expect(f.state.bonus).toBe('jackpot')
    f.send('buzz', { teamId: 'a' })
    expect(f.state.scores.a).toBe(0)
    const locked = f.state
    expect(f.send('bonus', { mode: 'lightning' })).toBe(locked)
    f.send('answer', { teamId: 'a', answer: { value: true } })
    expect(f.state.scores.a).toBe(35)
    f.send('next')
    expect(f.state.bonus).toBe('normal')
    f.send('bonus', { mode: 'lightning' })
    f.send('buzz', { teamId: 'b' })
    f.send('answer', { teamId: 'b', answer: { value: true } })
    expect(f.state.scores.b).toBe(21)
  })
  it('enforces lightning and round deadlines, never resurrects expired rounds', () => {
    const f = fixture({ lightningRound: { enabled: true, timePerQ: 1 } })
    f.send('start')
    f.send('bonus', { mode: 'lightning' })
    f.send('buzz', { teamId: 'a' })
    f.send('answer', { teamId: 'a', answer: { value: true } }, 1000)
    expect(f.state.phase).toBe('review')
    expect(f.state.scores.a).toBe(10)
    f.send('next', {}, 1000)
    f.send('deadline', {}, 30000)
    expect(f.state.roundExpired).toBe(true)
    f.send('next', {}, 30000)
    expect(f.state.roundId).toBe('r2')
    expect(f.state.roundDeadline).toBe(50000)
    const active = f.state
    expect(
      f.send('buzz', { roundId: 'r1', questionId: 'first', turn: 2, teamId: 'b' }, 30001)
    ).toBe(active)
  })
  it('rejects stale generations, malformed typed answers and duplicate next transitions', () => {
    const f = fixture()
    f.send('start')
    f.send('buzz', { teamId: 'a' })
    const active = f.state
    expect(f.send('answer', { generation: 5, teamId: 'a', answer: { value: true } })).toBe(active)
    expect(f.send('answer', { teamId: 'a', answer: { text: 'true' } }).error).toContain('answer')
    f.send('answer', { teamId: 'a', answer: { value: true } })
    const turn = f.state.turn
    f.send('next')
    const next = f.state
    expect(f.send('next', { turn, questionId: 'second' })).toBe(next)
    expect(createTriviaChampState(f.config).scores).toEqual({ a: 0, b: 0 })
  })
  it('makes empty authored rounds and teams no-play, without mutating config', () => {
    expect(fixture({ teams: [] }).state.phase).toBe('no-play')
    expect(fixture({ rounds: [] }).state.phase).toBe('no-play')
    const f = fixture(),
      before = JSON.stringify(f.config)
    f.send('start')
    f.send('buzz', { teamId: 'a' })
    expect(JSON.stringify(f.config)).toBe(before)
  })
})
