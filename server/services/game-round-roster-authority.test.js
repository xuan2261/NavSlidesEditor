// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { engine, fixture, now } from './game-authority-test-fixture'
const require = createRequire(import.meta.url)
const { createCanonicalQuestion } = require('../../shared/src/education/question-factory')
const q = (id) => createCanonicalQuestion({ id, kind: 'single-choice', timeLimit: null })
const assign = (f, playerId, teamId) => f.command('game-team-assign', { playerId, teamId })
const submit = (f, event, question, playerId, correct = true) =>
  f.command(
    event,
    {
      questionId: question.id,
      attemptId: `${playerId}-${question.id}`,
      answer: {
        optionId: correct
          ? question.answerKey.optionId
          : question.options.find((row) => row.id !== question.answerKey.optionId).id,
      },
    },
    playerId
  )
afterEach(() => engine._reset())
describe('closed-round pending roster admission', () => {
  it('admits late corners only on next playable start and never inherits admission after explicit leave', () => {
    const questions = ['q1', 'q2'].map((id) =>
      createCanonicalQuestion({
        id,
        kind: 'single-choice',
        timeLimit: null,
        options: ['A', 'B', 'C', 'D'].map((text, index) => ({
          id: `${id}/option-${index + 1}`,
          text,
        })),
        answerKey: { optionId: `${id}/option-1` },
      })
    )
    const f = fixture('four-corners', { questions })
    f.join()
    f.command('game-fourcorners-start')
    f.join('late')
    expect(engine.getPublicState('room', 'late')).toMatchObject({
      ownEligible: false,
      rosterWindow: false,
    })
    expect(
      f.command('game-fourcorners-choice', { cornerId: questions[0].answerKey.optionId }, 'late')
        .error
    ).toBe('waiting-next-round')
    f.command('game-fourcorners-reveal')
    expect(engine.getPublicState('room').rosterWindow).toBe(true)
    f.command('game-fourcorners-start')
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(true)
    engine.leaveRoom('room', 'late', { ...f.playerActors.get('late'), requireSession: true })
    f.join('late')
    expect(
      f.command('game-fourcorners-choice', { cornerId: questions[1].answerKey.optionId }, 'late')
        .error
    ).toBe('waiting-next-round')
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(false)
    f.command('game-fourcorners-reveal')
    f.command('game-fourcorners-start')
    expect(engine.getPublicState('room', 'late')).toMatchObject({
      status: 'finished',
      ownEligible: false,
    })
  })
  it('preserves buzz and assigned locks, then admits a pending team on next Trivia question without reset', () => {
    const questions = [q('q1'), q('q2')],
      f = fixture('trivia-champ', {
        questions,
        rounds: [
          { id: 'r', name: 'Round', mode: 'buzzer', questionIds: ['q1', 'q2'], timeLimit: 30 },
        ],
      })
    f.join()
    assign(f, 'learner', 'team-1')
    f.command('game-trivia-start')
    f.join('late')
    expect(assign(f, 'late', 'team-2').error).toBe('roster-locked')
    f.command('game-trivia-buzz', {}, 'learner')
    expect(f.command('game-trivia-buzz', {}, 'late').error).toBe('waiting-next-round')
    expect(engine.getPublicState('room').buzz.playerId).toBe('learner')
    submit(f, 'game-trivia-answer', questions[0], 'learner', false)
    expect(assign(f, 'learner', 'team-2').error).toBe('team-already-assigned')
    expect(assign(f, 'late', 'missing').error).toBe('invalid-team-assignment')
    expect(
      f.command('game-team-assign', { playerId: 'late', teamId: 'team-2' }, 'learner').error
    ).toBe('host-only')
    expect(assign(f, 'late', 'team-2').accepted).toBe(true)
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(false)
    expect(engine.getPublicState('room').teams.map((team) => team.score)).toEqual([10, 0])
    f.command('game-trivia-next')
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(true)
    expect(f.command('game-trivia-buzz', {}, 'late').accepted).toBe(true)
    expect(engine.getPublicState('room').teams.map((team) => team.score)).toEqual([10, 10])
    f.join('late', 'Late', { socketId: 'reconnected' })
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(true)
    f.command('game-reset')
    expect(
      engine.getPublicState('room').players.find((player) => player.playerId === 'late').teamId
    ).toBe('team-2')
    expect(assign(f, 'late', 'team-1').error).toBe('team-already-assigned')
  })
  it('does not partially start invalid Scatter or promote a pending assigned submitter until valid round opens', () => {
    const f = fixture('scattergories', { letterMode: 'manual', letter: 'A' })
    f.join()
    assign(f, 'learner', 'team-1')
    f.command('game-scatter-start')
    f.command(
      'game-scatter-submit',
      { entries: [{ categoryId: 'category-1', text: 'Apple' }] },
      'learner'
    )
    f.join('late')
    f.command('game-scatter-reveal')
    expect(assign(f, 'late', 'team-2').accepted).toBe(true)
    const reviewed = engine.getPublicState('room')
    expect(f.command('game-scatter-start', { letter: '?' }).accepted).toBe(false)
    expect(engine.getPublicState('room', 'late')).toMatchObject({
      phase: 'review',
      ownEligible: false,
      revealed: reviewed.revealed,
    })
    expect(f.command('game-scatter-start', { letter: 'B' }).accepted).toBe(true)
    expect(engine.getPublicState('room', 'late')).toMatchObject({
      ownEligible: true,
      scatter: { submitterPlayerId: 'late', letter: 'B' },
    })
    expect(
      f.command(
        'game-scatter-submit',
        { entries: [{ categoryId: 'category-1', text: 'Banana' }] },
        'late'
      ).accepted
    ).toBe(true)
  })
  it('admits on automatic relay baton without promoting during pass or blocking on unassigned late actors', async () => {
    const question = q('q1'),
      f = fixture('relay-race', {
        questions: [question],
        shuffleTeams: false,
        questionsPerRound: 3,
        passOnWrong: false,
      })
    f.join()
    assign(f, 'learner', 'team-1')
    f.command('game-relay-start')
    f.join('late')
    f.join('unassigned')
    expect(assign(f, 'late', 'team-2').error).toBe('roster-locked')
    f.command('game-relay-next')
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(false)
    expect(assign(f, 'late', 'team-2').accepted).toBe(true)
    const advanced = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        detach()
        reject(new Error('Missing automatic relay playable round'))
      }, 4000)
      const detach = engine.subscribeState((gameId) => {
        const state = engine.getPublicState(gameId, 'late')
        if (state?.roundId !== 2) return
        clearTimeout(timer)
        detach()
        resolve(state)
      })
    })
    const state = await advanced
    expect(state).toMatchObject({ ownEligible: true, turn: { turnPlayerId: 'late' } })
    expect(engine.getPublicState('room', 'unassigned').ownEligible).toBe(false)
    expect(submit(f, 'game-relay-answer', question, 'late').accepted).toBe(true)
  })
  it('uses the same promotion on authenticated host baton and never repeats it from the old envelope', () => {
    const question = q('q1'),
      f = fixture('relay-race', {
        questions: [question],
        shuffleTeams: false,
        questionsPerRound: 3,
        passOnWrong: false,
      })
    f.join()
    assign(f, 'learner', 'team-1')
    f.command('game-relay-start')
    submit(f, 'game-relay-answer', question, 'learner')
    f.join('late')
    assign(f, 'late', 'team-2')
    expect(f.command('game-relay-next').accepted).toBe(false)
    expect(engine.getPublicState('room', 'late').ownEligible).toBe(false)
    f.room.domain.batonDue = now() - 1
    const payload = f.envelope(),
      result = engine.command('game-relay-next', payload, f.hostActor)
    expect(result.accepted).toBe(true)
    const state = engine.getPublicState('room', 'late')
    expect(state).toMatchObject({
      ownEligible: true,
      turn: { turnPlayerId: 'late' },
      relay: { positions: { 'team-1': 1 } },
    })
    expect(engine.command('game-relay-next', payload, f.hostActor).duplicate).toBe(true)
    expect(engine.getPublicState('room', 'late').relay).toEqual(state.relay)
  })
})
