// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { engine, wireHarness, once } from './game-live-wire-fixture'
const require = createRequire(import.meta.url)
const { createCanonicalQuestion } = require('../../shared/src/education/question-factory')
let wire
beforeEach(async () => {
  wire = await wireHarness()
})
afterEach(async () => {
  await wire.close()
})
const kinds = [
  'single-choice',
  'multi-choice',
  'true-false',
  'fill-blank',
  'ordering',
  'matching',
  'image-hotspot',
]
function answer(question) {
  if (question.kind === 'image-hotspot') return { mode: 'point', x: 0.5, y: 0.5 }
  if (question.kind === 'fill-blank') return { text: question.answerKey.accepted[0] }
  return structuredClone(question.answerKey)
}
describe('native quiz real socket authority', () => {
  it.each(kinds)('accepts canonical %s with once-only award and no speed bonus', async (kind) => {
    const question = createCanonicalQuestion({
      id: 'q',
      kind,
      timeLimit: 30,
      feedback: { correct: 'own', explanation: 'private-explanation' },
    })
    const { host, a, b, room, sync } = await wire.fixture('quiz', { questions: [question] })
    const started = await host.command('game-next')
    expect(started.accepted, JSON.stringify(started)).toBe(true)
    await sync(started)
    const state = a.state()
    expect(state.question.kind).toBe(kind)
    expect(JSON.stringify(state)).not.toContain('answerKey')
    expect(JSON.stringify(state)).not.toContain('private-explanation')
    const payload = a.envelope({
      questionId: 'q',
      attemptId: 'attempt',
      answer: answer(question),
      points: 100000,
      timeSpentMs: 0,
    })
    const accepted = once(
      a.socket,
      'game-command-result',
      (result) => result.commandId === payload.commandId
    )
    a.socket.emit('game-answer', payload)
    const receipt = await accepted
    expect(receipt.accepted, JSON.stringify(receipt)).toBe(true)
    expect(receipt.result).toMatchObject({ correct: true, points: 10, totalScore: 10 })
    const duplicate = once(
      a.socket,
      'game-command-result',
      (result) => result.commandId === payload.commandId
    )
    a.socket.emit('game-answer', payload)
    expect((await duplicate).duplicate).toBe(true)
    expect(room.players.get('alice').score).toBe(10)
    expect(engine.getPublicState('quiz', 'bob').ownSubmission).toBeNull()
    expect(JSON.stringify(engine.getPublicState('quiz', 'bob'))).not.toContain(
      'private-explanation'
    )
    const token = a.session().sessionToken,
      fresh = await wire.client()
    await fresh.join('quiz', 'alice', { sessionToken: token })
    expect(fresh.state().ownSubmission).toMatchObject({
      commandId: payload.commandId,
      attemptId: 'attempt',
      result: { totalScore: 10 },
    })
    expect(
      (
        await a.command('game-answer', {
          questionId: 'q',
          attemptId: 'stale',
          answer: answer(question),
        })
      ).error
    ).toBe('stale-player-session')
    expect((await b.command('game-reset')).error).toBe('host-only')
  })
  it('preserves exact multi-choice attempts and rejects invalid IDs/conflicting receipts', async () => {
    const q = createCanonicalQuestion({
      id: 'q',
      kind: 'multi-choice',
      answerKey: { optionIds: ['q/option-1', 'q/option-2'] },
    })
    const { host, a, room } = await wire.fixture('quiz', {
      questions: [q],
      attemptLimit: 2,
      feedbackMode: 'after-question',
    })
    const ready = once(a.socket, 'game-round-state', (state) => state.roundId === 1)
    await host.command('game-next')
    await ready
    expect(
      (
        await a.command('game-answer', {
          questionId: 'q',
          attemptId: 'invalid',
          answer: { optionIds: ['unknown'] },
        })
      ).accepted
    ).toBe(false)
    const first = (
      await a.command('game-answer', {
        questionId: 'q',
        attemptId: 'first',
        answer: { optionIds: ['q/option-1'] },
      })
    ).result
    expect(first).toMatchObject({ terminal: false, attemptsUsed: 1 })
    expect(first).not.toHaveProperty('correct')
    expect(first).not.toHaveProperty('pointsAwarded')
    expect(a.state().ownSubmission.result).toEqual(first)
    expect(
      (
        await a.command('game-answer', {
          questionId: 'q',
          attemptId: 'second',
          answer: { optionIds: ['q/option-1'] },
        })
      ).result
    ).toMatchObject({ correct: false, terminal: true, attemptsUsed: 2 })
    const replay = await a.command('game-answer', {
      questionId: 'q',
      attemptId: 'first',
      answer: { optionIds: ['q/option-1'] },
    })
    expect(replay).toMatchObject({ accepted: true, duplicate: true, result: first })
    expect(
      (await a.command('game-answer', { questionId: 'q', attemptId: 'third', answer: answer(q) }))
        .accepted
    ).toBe(false)
    expect(room.players.get('alice').score).toBe(0)
    const old = a.envelope({ questionId: 'q', attemptId: 'old', answer: answer(q) })
    await host.command('game-reset')
    const rejected = once(
      a.socket,
      'game-command-result',
      (result) => result.commandId === old.commandId
    )
    a.socket.emit('game-answer', old)
    expect((await rejected).error).toBe('stale-generation')
  })
  it('recovers deferred accepted attempts, reveals on host closure and honors hidden own score', async () => {
    const q = createCanonicalQuestion({ id: 'q', kind: 'single-choice', timeLimit: null })
    const { host, a } = await wire.fixture('quiz', {
      questions: [q],
      attemptLimit: 2,
      feedbackMode: 'after-question',
      showScore: false,
    })
    const ready = once(a.socket, 'game-round-state', (state) => state.roundId === 1)
    await host.command('game-next')
    await ready
    const fields = { questionId: 'q', attemptId: 'first', answer: { optionId: q.options[1].id } }
    const first = await a.command('game-answer', fields)
    expect(first.result).not.toHaveProperty('correct')
    expect(first.result).not.toHaveProperty('totalScore')
    const fresh = await wire.client()
    await fresh.join('quiz', 'alice', { sessionToken: a.session().sessionToken })
    expect(fresh.state().ownSubmission).toMatchObject({
      answer: fields.answer,
      attemptId: 'first',
      result: first.result,
    })
    const revealed = once(fresh.socket, 'game-round-state', (state) => state.phase === 'review')
    await host.command('game-quiz-reveal')
    const state = await revealed
    expect(state.ownSubmission.result).toMatchObject({ correct: false, terminal: true })
    expect(state.ownSubmission.result).not.toHaveProperty('totalScore')
    expect(state.ownSubmission.reveal.answerKey).toEqual(q.answerKey)
    expect(JSON.stringify(first.result)).not.toContain('answerKey')
  })
  it('rejects pre-envelope mutation and room replacement identities', async () => {
    const { host, a } = await wire.fixture('quiz')
    const rejected = once(host.socket, 'game-command-result')
    host.socket.emit('game-next', { gameId: 'quiz', commandId: 'old' })
    expect((await rejected).error).toBe('stale-room-instance')
    const old = a.envelope({ questionId: 'q', attemptId: 'a', answer: {} })
    engine.cleanup('quiz')
    engine.createRoom('quiz', 'quiz')
    const fresh = await wire.client()
    await fresh.join('quiz', 'alice')
    const result = once(fresh.socket, 'game-command-result')
    fresh.socket.emit('game-answer', old)
    expect((await result).error).toBe('stale-room-instance')
  })
})
