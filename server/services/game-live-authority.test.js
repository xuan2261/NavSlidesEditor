// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const engine = require('./game-room-manager-singleton-service')
const { createDefaultGameConfig } = require('../../shared/src/education/game-defaults')
afterEach(() => engine._reset())
function fixture(type, overrides = {}, id = type) {
  const room = engine.createRoom(id, type, { ...createDefaultGameConfig(type), ...overrides })
  const capability = engine.peekHostCapability(id)
  const host = engine.joinRoom(id, 'host', 'Host', {
    role: 'host',
    socketId: 'host-socket',
    hostCapability: capability,
    requireSession: true,
  })
  const learner = engine.joinRoom(id, 'learner', 'Learner', {
    socketId: 'learner-socket',
    requireSession: true,
  })
  const actor = {
    playerId: 'learner',
    socketId: 'learner-socket',
    sessionToken: learner.sessionToken,
  }
  const hostActor = {
    playerId: 'host',
    socketId: 'host-socket',
    sessionToken: host.sessionToken,
    hostCapability: capability,
  }
  let counter = 0
  const envelope = (extra) => ({
    gameId: id,
    roomInstanceId: room.roomInstanceId,
    generation: room.generation,
    roundId: room.roundId,
    commandId: `cmd-${++counter}`,
    ...extra,
  })
  const command = (event, data = {}, who = hostActor) => engine.command(event, envelope(data), who)
  return { room, actor, hostActor, envelope, command }
}
describe('live room authority', () => {
  it('binds envelopes, actors and receipts while preserving accepted own answers on reconnect', () => {
    const f = fixture('quiz')
    expect(f.command('game-next').accepted).toBe(true)
    const question = f.room.questions[0]
    const payload = f.envelope({
      questionId: question.id,
      attemptId: 'attempt-1',
      answer: { optionId: question.answerKey.optionId },
      points: 9999,
    })
    const first = engine.command('game-answer', payload, f.actor)
    expect(first).toMatchObject({
      accepted: true,
      result: { correct: true, points: 10, totalScore: 10 },
    })
    expect(engine.command('game-answer', payload, f.actor)).toMatchObject({
      accepted: true,
      duplicate: true,
    })
    expect(
      engine.command('game-answer', { ...payload, answer: { optionId: 'other' } }, f.actor).error
    ).toBe('command-id-conflict')
    expect(engine.command('game-answer', { ...payload, generation: 999 }, f.actor).error).toBe(
      'stale-generation'
    )
    const joined = engine.joinRoom('quiz', 'learner', 'Learner', {
      socketId: 'new-socket',
      sessionToken: f.actor.sessionToken,
      requireSession: true,
    })
    expect(joined.ok).toBe(true)
    expect(engine.getPublicState('quiz', 'learner').ownSubmission.result.totalScore).toBe(10)
    expect(
      engine.command(
        'game-answer',
        f.envelope({ questionId: question.id, attemptId: 'attempt-2', answer: {} }),
        f.actor
      ).error
    ).toBe('stale-player-session')
    expect(f.room.players.get('learner').score).toBe(10)
  })
  it('rejects conflicting reuse of a Hot Potato attempt without changing awarded score', () => {
    const f = fixture('hot-potato', { shuffleQuestions: false })
    f.command('game-next')
    const question = f.room.questions[0],
      index = question.options.findIndex((option) => option.id === question.answerKey.optionId)
    const fields = { questionId: question.id, attemptId: 'stable-attempt', answerIndex: index }
    const first = f.command('game-answer', fields, f.actor)
    expect(first.accepted).toBe(true)
    expect(f.command('game-answer', fields, f.actor)).toMatchObject({
      accepted: true,
      duplicate: true,
      result: first.result,
    })
    expect(
      f.command(
        'game-answer',
        { ...fields, answerIndex: (index + 1) % question.options.length },
        f.actor
      ).error
    ).toBe('attempt-id-conflict')
    expect(f.room.players.get('learner').score).toBe(first.result.totalScore)
  })
  it('replays the original typed attempt result without reanchoring a later accepted answer', () => {
    const f = fixture('quiz', { attemptLimit: 2 })
    f.command('game-next')
    const q = f.room.questions[0],
      wrong = q.options.find((option) => option.id !== q.answerKey.optionId).id
    const fields = { questionId: q.id, attemptId: 'wrong', answer: { optionId: wrong } }
    const first = f.command('game-answer', fields, f.actor)
    f.command(
      'game-answer',
      { questionId: q.id, attemptId: 'right', answer: { optionId: q.answerKey.optionId } },
      f.actor
    )
    const accepted = engine.getPublicState('quiz', 'learner').ownSubmission,
      version = f.room.stateVersion
    expect(f.command('game-answer', fields, f.actor)).toMatchObject({
      accepted: true,
      duplicate: true,
      result: first.result,
    })
    expect(engine.getPublicState('quiz', 'learner').ownSubmission).toEqual(accepted)
    expect(f.room.stateVersion).toBe(version)
  })
  it('keeps the command cap bounded without denying authenticated generation reset', () => {
    const f = fixture('poll')
    for (let i = 0; i < 4096; i++) f.command('game-poll-submit', { optionId: 'unknown' }, f.actor)
    expect(f.command('game-poll-submit', { optionId: 'unknown' }, f.actor).error).toBe(
      'command-limit'
    )
    expect(f.command('game-reset').accepted).toBe(true)
    expect(f.room.generation).toBe(1)
    expect(f.command('game-poll-start').accepted).toBe(true)
    expect(
      f.command('game-poll-submit', { optionId: f.room.config.options[0].id }, f.actor).accepted
    ).toBe(true)
    expect(engine.getPollAggregate('poll').totalVotes).toBe(1)
  })
  it('never exposes private nested question data or another learner submission before reveal', () => {
    const f = fixture('quiz')
    f.command('game-next')
    const publicState = engine.getPublicState('quiz')
    expect(JSON.stringify(publicState)).not.toContain('answerKey')
    expect(JSON.stringify(publicState)).not.toContain('explanation')
    expect(publicState.ownSubmission).toBeNull()
    expect(f.command('game-reset', {}, f.actor).error).toBe('host-only')
    const stale = f.envelope()
    f.command('game-reset')
    expect(engine.command('game-next', stale, f.hostActor).error).toBe('stale-generation')
  })
  it('uses the corners reducer deadline and honors untimed canonical questions', () => {
    const question = createDefaultGameConfig('four-corners').questions[0]
    const timed = fixture(
      'four-corners',
      { timerDuration: 10, questions: [{ ...question, timeLimit: 5 }] },
      'timed'
    )
    timed.command('game-fourcorners-start')
    expect(timed.room.deadlineMs).toBe(timed.room.domain.deadline)
    const untimed = fixture(
      'four-corners',
      { questions: [{ ...question, timeLimit: null }] },
      'untimed'
    )
    untimed.command('game-fourcorners-start')
    expect(engine.getPublicState('untimed').timeRemainingMs).toBeNull()
    expect(untimed.room.roundTimer).toBeNull()
  })
  it('locks team assignment, relay holder and room-local turn state', () => {
    const f = fixture('relay-race', { shuffleTeams: false })
    expect(f.command('game-team-assign', { playerId: 'learner', teamId: 'team-1' }).accepted).toBe(
      true
    )
    f.command('game-relay-start')
    expect(engine.getPublicState('relay-race').turn.turnPlayerId).toBe('learner')
    expect(f.command('game-team-assign', { playerId: 'learner', teamId: 'team-2' }).error).toBe(
      'roster-locked'
    )
    expect(
      f.command(
        'game-relay-answer',
        {
          questionId: f.room.questions[0].id,
          attemptId: 'a',
          answer: { optionId: f.room.questions[0].answerKey.optionId },
        },
        f.hostActor
      ).error
    ).toBe('player-only')
    const other = fixture('relay-race', { shuffleTeams: false }, 'other')
    expect(other.room.domain.phase).toBe('setup')
  })
  it.each([undefined, 0])(
    'awards first buzz independently once with configured points %s',
    (points) => {
      const config = createDefaultGameConfig('trivia-champ')
      config.rounds[0].mode = 'buzzer'
      if (points !== undefined) config.buzzPoints = points
      const f = fixture('trivia-champ', config)
      f.command('game-team-assign', { playerId: 'learner', teamId: 'team-1' })
      f.command('game-trivia-start')
      const payload = f.envelope()
      expect(engine.command('game-trivia-buzz', payload, f.actor).accepted).toBe(true)
      engine.command('game-trivia-buzz', payload, f.actor)
      expect(f.room.domain.scores['team-1']).toBe(points ?? 10)
      expect(f.command('game-trivia-buzz', {}, f.actor).error).toBe('buzz-already-awarded')
    }
  )
  it('validates scatter category/initial and scores duplicate normalized words without uniqueness bonus', () => {
    const f = fixture('scattergories', { letterMode: 'manual', letter: 'A' })
    f.command('game-team-assign', { playerId: 'learner', teamId: 'team-1' })
    f.command('game-scatter-start')
    expect(
      f.command(
        'game-scatter-submit',
        { entries: [{ categoryId: 'unknown', text: 'Apple' }] },
        f.actor
      ).error
    ).toBe('invalid-scatter-entry')
    expect(
      f.command(
        'game-scatter-submit',
        { entries: [{ categoryId: 'category-1', text: 'Banana' }] },
        f.actor
      ).error
    ).toBe('wrong-initial-letter')
    expect(
      f.command(
        'game-scatter-submit',
        { entries: [{ categoryId: 'category-1', text: ' Apple ' }] },
        f.actor
      ).accepted
    ).toBe(true)
    f.command('game-scatter-reveal')
    expect(f.room.domain.scores['team-1']).toBe(10)
  })
  it('keeps scatter submission IDs distinct across actors and rejects newly submitted review answers', () => {
    const f = fixture('scattergories', { letterMode: 'manual', letter: 'A' })
    const joined = engine.joinRoom('scattergories', 'other', 'Other', { socketId: 'other-socket' })
    const other = { playerId: 'other', socketId: 'other-socket', sessionToken: joined.sessionToken }
    f.command('game-team-assign', { playerId: 'learner', teamId: 'team-1' })
    f.command('game-team-assign', { playerId: 'other', teamId: 'team-2' })
    f.command('game-scatter-start')
    const a = engine.command(
      'game-scatter-submit',
      f.envelope({ commandId: 'same', entries: [{ categoryId: 'category-1', text: 'Apple' }] }),
      f.actor
    )
    const b = engine.command(
      'game-scatter-submit',
      f.envelope({ commandId: 'same', entries: [{ categoryId: 'category-1', text: 'Apricot' }] }),
      other
    )
    expect(a.accepted).toBe(true)
    expect(b.accepted).toBe(true)
    expect(a.result.submissionId).not.toBe(b.result.submissionId)
    f.command('game-scatter-reveal')
    const closed = fixture('scattergories', { letterMode: 'manual', letter: 'A' }, 'closed')
    closed.command('game-team-assign', { playerId: 'learner', teamId: 'team-1' })
    closed.command('game-scatter-start')
    closed.command('game-scatter-reveal')
    expect(
      closed.command(
        'game-scatter-submit',
        { entries: [{ categoryId: 'category-1', text: 'Apple' }] },
        closed.actor
      ).accepted
    ).toBe(false)
    expect(closed.room.scatterSubmissions.size).toBe(0)
    expect(closed.room.domain.answers).toEqual({})
  })
  it('derives Jeopardy stake, clamps negative scores and closes adjudication once', () => {
    const f = fixture('jeopardy', { negativePoints: true, dailyDouble: ['cell-100'] })
    expect(f.command('game-jeopardy-select', { cellId: 'cell-100' }).accepted).toBe(true)
    expect(f.command('game-jeopardy-wager', { amount: 1000 }).accepted).toBe(true)
    f.command('game-jeopardy-reveal')
    const payload = f.envelope({ correct: true, points: 999999 })
    expect(engine.command('game-jeopardy-adjudicate', payload, f.hostActor).accepted).toBe(true)
    expect(engine.command('game-jeopardy-adjudicate', payload, f.hostActor).duplicate).toBe(true)
    expect(f.room.domain.scores['team-1']).toBe(1000)
    expect(f.command('game-jeopardy-select', { cellId: 'cell-100' }).error).toBe('cell-used')
    f.command('game-jeopardy-select', { cellId: 'cell-200' })
    f.command('game-jeopardy-reveal')
    f.command('game-jeopardy-adjudicate', { correct: false })
    expect(f.room.domain.scores['team-1']).toBe(800)
  })
})
