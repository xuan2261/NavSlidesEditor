import { describe, expect, it } from 'vitest'
import { normalizeGameConfig } from '../../src/education/normalize-game-config.js'
import { createCanonicalQuestion } from '../../src/education/question-schema.js'
import { createRelayRaceState, reduceRelayRace } from '../../src/education/games/relay-race.js'
const question = createCanonicalQuestion({ id: 'q', kind: 'fill-blank', points: 37 })
function fixture(overrides = {}) {
  const config = normalizeGameConfig(
    {
      teams: [
        { id: 'a', name: 'Same' },
        { id: 'b', name: 'Same' },
      ],
      questions: [question],
      ...overrides,
    },
    'relay-race'
  )
  let state = { ...createRelayRaceState(config), generation: 0 }
  const send = (type, data = {}, now = 0) =>
    (state = reduceRelayRace(
      config,
      state,
      { type, generation: 0, turn: state.turn, questionId: state.questionId, ...data },
      { now: () => now, random: () => 0 }
    ))
  return {
    config,
    send,
    get state() {
      return state
    },
  }
}
describe('Relay round outcomes', () => {
  it('evaluates typed answers once and delays bounded lane movement until 1200ms', () => {
    const f = fixture({ questionsPerRound: 1 })
    f.send('start')
    const command = {
      type: 'answer',
      generation: 0,
      turn: f.state.turn,
      questionId: 'q',
      teamId: 'a',
      answer: { text: 'answer' },
    }
    const pending = reduceRelayRace(f.config, f.state, command, { now: () => 0 })
    expect(pending.phase).toBe('waiting')
    expect(pending.positions).toEqual({ a: 0, b: 0 })
    expect(reduceRelayRace(f.config, pending, command)).toBe(pending)
    f.send('answer', { teamId: 'a', answer: { text: 'Answer' } })
    f.send('baton', {}, 1199)
    expect(f.state.phase).toBe('waiting')
    f.send('baton', {}, 1200)
    expect(f.state.positions).toEqual({ a: 1, b: 0 })
    expect(f.state.winnerId).toBe('a')
    const terminal = f.state
    expect(f.send('baton', {}, 9999)).toBe(terminal)
  })
  it('passes a wrong answer to the next lane and skips its answering turn', () => {
    const f = fixture()
    f.send('start')
    f.send('answer', { teamId: 'a', answer: { text: 'wrong' } })
    f.send('baton', {}, 1200)
    expect(f.state.positions).toEqual({ a: 0, b: 1 })
    expect(f.state.activeTeamId).toBe('a')
    const state = f.state
    expect(f.send('answer', { turn: 1, teamId: 'a', answer: { text: 'Answer' } }, 1201)).toBe(state)
  })
  it('keeps an opponent finish terminal and preserves the one-team self pass', () => {
    for (const teams of [
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      [{ id: 'a', name: 'A' }],
    ]) {
      const f = fixture({ teams, questionsPerRound: 1 })
      f.send('start')
      f.send('pass')
      f.send('baton', {}, 1200)
      expect(f.state.phase).toBe('ended')
      expect(f.state.winnerId).toBe(teams.at(-1).id)
      expect(f.send('deadline', {}, 99999).phase).toBe('ended')
    }
  })
  it('advances deadlines only with passOnWrong and never accepts a late answer', () => {
    const f = fixture({ timerDuration: 1 })
    f.send('start')
    f.send('deadline', {}, 1000)
    expect(f.state.phase).toBe('waiting')
    f.send('baton', {}, 2200)
    expect(f.state.positions.b).toBe(1)
    const disabled = fixture({ timerDuration: 1, passOnWrong: false })
    disabled.send('start')
    expect(disabled.send('deadline', {}, 1000).phase).toBe('active')
    disabled.send('answer', { teamId: 'a', answer: { text: 'Answer' } }, 1000)
    expect(disabled.state.positions.a).toBe(0)
    disabled.send('pass', {}, 1000)
    disabled.send('baton', {}, 2200)
    expect(disabled.state.positions).toEqual({ a: 0, b: 0 })
    expect(disabled.state.activeTeamId).toBe('b')
  })
  it('rejects invalid payloads, stale generations and the wrong team without changing saved config', () => {
    const f = fixture(),
      before = JSON.stringify(f.config)
    f.send('start')
    const state = f.state
    expect(f.send('answer', { teamId: 'b', answer: { text: 'Answer' } })).toBe(state)
    expect(f.send('answer', { generation: 9, teamId: 'a', answer: { text: 'Answer' } })).toBe(state)
    expect(f.send('answer', { teamId: 'a', answer: { optionId: 'fake' } }).error).toContain(
      'answer'
    )
    expect(JSON.stringify(f.config)).toBe(before)
  })
  it('explicitly declines play when no teams or no questions exist', () => {
    expect(fixture({ teams: [] }).state.phase).toBe('no-play')
    expect(fixture({ questions: [] }).state.phase).toBe('no-play')
  })
})
