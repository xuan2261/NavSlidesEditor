// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { wireHarness, once, engine } from './game-live-wire-fixture'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createCanonicalQuestion } = require('../../shared/src/education/question-factory')
let wire
beforeEach(async () => {
  wire = await wireHarness()
})
afterEach(async () => {
  await wire.close()
})
async function teams(f) {
  for (const [playerId, teamId] of [
    ['alice', 'team-1'],
    ['bob', 'team-2'],
  ]) {
    const receipt = await f.host.command('game-team-assign', { playerId, teamId })
    expect(receipt.accepted, JSON.stringify(receipt)).toBe(true)
    await f.sync(receipt)
  }
}
async function start(f, event) {
  const receipt = await f.host.command(event)
  expect(receipt.accepted, JSON.stringify(receipt)).toBe(true)
  await f.sync(receipt)
}
describe('server owned native rounds over real sockets', () => {
  it('closes corners once, preserves secret choice and shares absolute elimination scores', async () => {
    const f = await wire.fixture('four-corners')
    await start(f, 'game-fourcorners-start')
    const question = f.room.domain.currentQuestion
    expect(
      (await f.a.command('game-fourcorners-choice', { cornerId: question.answerKey.optionId }))
        .accepted
    ).toBe(true)
    expect(
      (await f.b.command('game-fourcorners-choice', { cornerId: question.options[1].id })).accepted
    ).toBe(true)
    expect(JSON.stringify(f.a.state())).not.toContain('answerKey')
    expect((await f.b.command('game-fourcorners-reveal')).error).toBe('host-only')
    const revealed = once(f.a.socket, 'game-round-state', (state) => state.phase === 'revealed')
    await f.host.command('game-fourcorners-reveal')
    const state = await revealed
    expect(state.leaderboard.find((row) => row.playerId === 'alice').score).toBe(10)
    expect(state.corners.eliminated).toContain('bob')
    expect((await f.host.command('game-fourcorners-reveal')).accepted).toBe(false)
    expect(engine.getPublicState('four-corners', 'bob').leaderboard).toEqual(state.leaderboard)
  })
  it('binds relay holder and freezes roster while baton advances only once', async () => {
    const f = await wire.fixture('relay-race', { shuffleTeams: false, questionsPerRound: 1 })
    await teams(f)
    await start(f, 'game-relay-start')
    expect(f.a.state().turn).toMatchObject({ activeTeamId: 'team-1', turnPlayerId: 'alice' })
    expect(
      (
        await f.b.command('game-relay-answer', {
          questionId: 'question-1',
          attemptId: 'wrong-actor',
          answer: {},
        })
      ).error
    ).toBe('not-turn-holder')
    expect(
      (await f.host.command('game-team-assign', { playerId: 'bob', teamId: 'team-1' })).error
    ).toBe('roster-locked')
    const late = await wire.client()
    await late.join('relay-race', 'late')
    expect(
      (
        await late.command('game-relay-answer', {
          questionId: 'question-1',
          attemptId: 'late',
          answer: {},
        })
      ).error
    ).toBe('waiting-next-round')
    const question = f.room.questions[0],
      finished = once(f.a.socket, 'game-round-state', (state) => state.phase === 'ended')
    expect(
      (
        await f.a.command('game-relay-answer', {
          questionId: question.id,
          attemptId: 'a',
          answer: { optionId: question.answerKey.optionId },
        })
      ).accepted
    ).toBe(true)
    const state = await finished
    expect(state.relay.positions['team-1']).toBe(1)
    expect((await f.host.command('game-relay-next')).accepted).toBe(false)
  })
  it.each([10, 0])(
    'orders buzzer receipt once with independent %i-point award',
    async (buzzPoints) => {
      const f = await wire.fixture('trivia-champ', {
        buzzPoints,
        rounds: [
          { id: 'r', name: 'Buzzer', mode: 'buzzer', questionIds: ['question-1'], timeLimit: 30 },
        ],
      })
      await teams(f)
      await start(f, 'game-trivia-start')
      expect((await f.a.command('game-trivia-buzz')).accepted).toBe(true)
      expect((await f.b.command('game-trivia-buzz')).error).toBe('buzz-already-awarded')
      const q = f.room.questions[0]
      expect(
        (
          await f.b.command('game-trivia-answer', {
            questionId: q.id,
            attemptId: 'b',
            answer: { optionId: q.answerKey.optionId },
          })
        ).error
      ).toBe('not-buzz-winner')
      expect(
        (
          await f.a.command('game-trivia-answer', {
            questionId: q.id,
            attemptId: 'a',
            answer: { optionId: q.options[1].id },
          })
        ).result.correct
      ).toBe(false)
      expect(engine.getPublicState('trivia-champ').teams[0].score).toBe(buzzPoints)
    }
  )
  it('uses roster-owned individual turns but credits only authored teams', async () => {
    const f = await wire.fixture('trivia-champ', {
      rounds: [
        {
          id: 'individual',
          name: 'Individual',
          mode: 'individual',
          questionIds: ['question-1'],
          timeLimit: 30,
        },
      ],
    })
    await teams(f)
    await start(f, 'game-trivia-start')
    const q = f.room.questions[0]
    expect(f.a.state().turn.turnPlayerId).toBe('alice')
    expect(
      (
        await f.b.command('game-trivia-answer', {
          questionId: q.id,
          attemptId: 'b',
          answer: { optionId: q.answerKey.optionId },
        })
      ).error
    ).toBe('not-turn-holder')
    expect(
      (
        await f.a.command('game-trivia-answer', {
          questionId: q.id,
          attemptId: 'a',
          answer: { optionId: q.answerKey.optionId },
          teamId: 'team-2',
          points: 9999,
        })
      ).accepted
    ).toBe(true)
    expect(engine.getPublicState('trivia-champ').teams.map((team) => team.score)).toEqual([10, 0])
  })
  it('credits the first eligible submitted actor in team mode, never payload actor/team authority', async () => {
    const f = await wire.fixture('trivia-champ', {
      rounds: [
        { id: 'team', name: 'Team', mode: 'team', questionIds: ['question-1'], timeLimit: 30 },
      ],
    })
    await teams(f)
    await start(f, 'game-trivia-start')
    const q = f.room.questions[0]
    const receipt = await f.b.command('game-trivia-answer', {
      questionId: q.id,
      attemptId: 'b',
      answer: { optionId: q.answerKey.optionId },
      playerId: 'alice',
      teamId: 'team-1',
    })
    expect(receipt.accepted, JSON.stringify(receipt)).toBe(true)
    expect(engine.getPublicState('trivia-champ').teams.map((team) => team.score)).toEqual([0, 10])
    expect(
      (
        await f.a.command('game-trivia-answer', {
          questionId: q.id,
          attemptId: 'a',
          answer: { optionId: q.answerKey.optionId },
        })
      ).accepted
    ).toBe(false)
  })
  it('hydrates pending membership, admits next-question actors and preserves admission on authenticated reconnect', async () => {
    const questions = ['q1', 'q2'].map((id) =>
      createCanonicalQuestion({ id, kind: 'single-choice', timeLimit: null })
    )
    const f = await wire.fixture('trivia-champ', {
      questions,
      rounds: [
        { id: 'r', name: 'Round', mode: 'buzzer', questionIds: ['q1', 'q2'], timeLimit: 30 },
      ],
    })
    await teams(f)
    await start(f, 'game-trivia-start')
    const late = await wire.client()
    await late.join('trivia-champ', 'late')
    expect(late.state()).toMatchObject({ ownEligible: false, rosterWindow: false })
    expect(JSON.stringify(late.state())).not.toContain('answerKey')
    expect(
      (await f.host.command('game-team-assign', { playerId: 'late', teamId: 'team-2' })).error
    ).toBe('roster-locked')
    await f.a.command('game-trivia-buzz')
    expect((await late.command('game-trivia-buzz')).error).toBe('waiting-next-round')
    await f.a.command('game-trivia-answer', {
      questionId: 'q1',
      attemptId: 'wrong',
      answer: { optionId: questions[0].options[1].id },
    })
    expect(
      (await f.host.command('game-team-assign', { playerId: 'late', teamId: 'team-2' })).accepted
    ).toBe(true)
    expect(late.state().ownEligible).toBe(false)
    const admitted = once(
      late.socket,
      'game-round-state',
      (state) => state.roundId === 2 && state.ownEligible
    )
    await f.host.command('game-trivia-next')
    const state = await admitted
    expect(state.players.find((player) => player.playerId === 'late')).toMatchObject({
      eligible: true,
      pending: false,
      teamId: 'team-2',
    })
    const fresh = await wire.client()
    await fresh.join('trivia-champ', 'late', { sessionToken: late.session().sessionToken })
    expect(fresh.state().ownEligible).toBe(true)
    expect((await late.command('game-trivia-buzz')).error).toBe('stale-player-session')
    expect((await fresh.command('game-trivia-buzz')).accepted).toBe(true)
    expect(fresh.state().teams.map((team) => team.score)).toEqual([10, 10])
  })
  it('validates scatter entries and host meaning adjudication without duplicate unique scoring', async () => {
    const f = await wire.fixture('scattergories', { letterMode: 'manual', letter: 'A' })
    await teams(f)
    await start(f, 'game-scatter-start')
    expect(
      (
        await f.a.command('game-scatter-submit', {
          entries: [{ categoryId: 'bad', text: 'Apple' }],
        })
      ).error
    ).toBe('invalid-scatter-entry')
    expect(
      (
        await f.a.command('game-scatter-submit', {
          entries: [{ categoryId: 'category-1', text: 'Banana' }],
        })
      ).error
    ).toBe('wrong-initial-letter')
    const a = await f.a.command('game-scatter-submit', {
      entries: [
        { categoryId: 'category-1', text: ' Apple ' },
        { categoryId: 'category-2', text: 'Ant' },
      ],
    })
    await f.b.command('game-scatter-submit', {
      entries: [{ categoryId: 'category-1', text: 'APPLE' }],
    })
    expect(engine.getPublicState('scattergories', 'bob').revealed).toBeNull()
    await f.host.command('game-scatter-reveal')
    expect(engine.getPublicState('scattergories').teams.map((team) => team.score)).toEqual([10, 0])
    expect(
      (
        await f.a.command('game-scatter-adjudicate', {
          submissionId: a.result.submissionId,
          categoryId: 'category-2',
          valid: false,
        })
      ).error
    ).toBe('host-only')
    await f.host.command('game-scatter-adjudicate', {
      submissionId: a.result.submissionId,
      categoryId: 'category-2',
      valid: false,
    })
    expect(engine.getPublicState('scattergories').teams.map((team) => team.score)).toEqual([0, 0])
  })
})
